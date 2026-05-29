import { canEditOwnedProject, type Actor } from '../projects/project.policy';
import { ARTIFACT_STATUS, ARTIFACT_TYPE, AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants';
import {
  knowledgebaseArtifactContentDto,
  projectKnowledgebaseGraph,
  type KnowledgebaseArtifactContentDto,
} from '../knowledgebase';
import type { KnowledgebaseRepository } from '../knowledgebase';
import type { ArtifactRecord, ArtifactRepository } from './artifact.types';
import type { AuditLogRepository, ProjectRepository } from '../projects/project.types';
import {
  ArtifactApprovalForbiddenError,
  ArtifactApprovalInvalidStateError,
  ArtifactNotFoundError,
} from './approve-artifact.action';
import {
  updateKnowledgebaseRelationshipDto,
  type UpdateKnowledgebaseRelationshipInput,
} from './update-knowledgebase-relationship.dto';

export type UpdateKnowledgebaseRelationshipDeps = {
  artifactRepository: ArtifactRepository;
  auditLogRepository: AuditLogRepository;
  knowledgebaseRepository: KnowledgebaseRepository;
  projectRepository: ProjectRepository;
};

export async function updateKnowledgebaseRelationship(
  input: UpdateKnowledgebaseRelationshipInput,
  deps: UpdateKnowledgebaseRelationshipDeps,
  actor: Actor
): Promise<ArtifactRecord> {
  const dto = updateKnowledgebaseRelationshipDto.parse(input);
  const artifact = await deps.artifactRepository.findById(dto.artifactId);

  if (!artifact) {
    throw new ArtifactNotFoundError();
  }

  const project = await deps.projectRepository.findById(artifact.projectId);

  if (!canEditOwnedProject(actor, project)) {
    throw new ArtifactApprovalForbiddenError();
  }

  if (artifact.type !== ARTIFACT_TYPE.CONCEPT_GRAPH) {
    throw new ArtifactApprovalInvalidStateError(
      'Only concept graph artifacts can update knowledgebase relationships.'
    );
  }

  if (
    artifact.status !== ARTIFACT_STATUS.GENERATED &&
    artifact.status !== ARTIFACT_STATUS.NEEDS_REVISION
  ) {
    throw new ArtifactApprovalInvalidStateError(
      'Knowledgebase relationships can only be edited while the artifact is under review.'
    );
  }

  if (!artifact.currentVersionId) {
    throw new ArtifactApprovalInvalidStateError('Artifact has no current version to edit.');
  }

  const currentVersion = await findCurrentVersion(deps.artifactRepository, artifact);
  const currentContent = knowledgebaseArtifactContentDto.parse(currentVersion.content);
  const nextContent = patchKnowledgebaseRelationship(currentContent, {
    relationshipId: dto.relationshipId,
    relationshipType: dto.relationshipType,
    sourceConceptId: dto.sourceConceptId,
    targetConceptId: dto.targetConceptId,
  });

  const nextVersion = await deps.artifactRepository.createVersion({
    artifactId: artifact.id,
    content: nextContent,
    extractionMode: currentVersion.extractionMode,
    revisionFeedback: `Manual knowledgebase relationship update: ${dto.relationshipId}`,
  });

  await deps.knowledgebaseRepository.replaceVersionFromContent({
    content: nextContent,
    projectId: artifact.projectId,
  });

  const updatedArtifact = await deps.artifactRepository.updateStatus(
    artifact.id,
    ARTIFACT_STATUS.GENERATED
  );

  if (!updatedArtifact) {
    throw new ArtifactNotFoundError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: AUDIT_ACTION.ARTIFACT_KNOWLEDGEBASE_RELATIONSHIP_UPDATED,
    entityType: AUDIT_ENTITY_TYPE.ARTIFACT,
    entityId: updatedArtifact.id,
    metadata: {
      nextArtifactVersionId: nextVersion.id,
      previousArtifactVersionId: currentVersion.id,
      relationshipId: dto.relationshipId,
      sourceConceptId: dto.sourceConceptId,
      targetConceptId: dto.targetConceptId,
    },
  });

  return updatedArtifact;
}

async function findCurrentVersion(
  artifactRepository: ArtifactRepository,
  artifact: ArtifactRecord
) {
  const versions = await artifactRepository.listVersions(artifact.id);
  const currentVersion = versions.find((version) => version.id === artifact.currentVersionId);

  if (!currentVersion) {
    throw new ArtifactApprovalInvalidStateError('Current artifact version was not found.');
  }

  return currentVersion;
}

function patchKnowledgebaseRelationship(
  content: KnowledgebaseArtifactContentDto,
  input: {
    relationshipId: string;
    relationshipType: KnowledgebaseArtifactContentDto['knowledgebase']['relationships'][number]['relationshipType'];
    sourceConceptId: string;
    targetConceptId: string;
  }
): KnowledgebaseArtifactContentDto {
  if (input.sourceConceptId === input.targetConceptId) {
    throw new ArtifactApprovalInvalidStateError('Relationship source and target must differ.');
  }

  const conceptIds = new Set(content.knowledgebase.concepts.map((concept) => concept.id));
  if (!conceptIds.has(input.sourceConceptId) || !conceptIds.has(input.targetConceptId)) {
    throw new ArtifactApprovalInvalidStateError('Relationship concepts were not found.');
  }

  let found = false;
  const knowledgebase = {
    ...content.knowledgebase,
    relationships: content.knowledgebase.relationships.map((relationship) => {
      if (relationship.id !== input.relationshipId) {
        return relationship;
      }

      found = true;
      return {
        ...relationship,
        relationshipType: input.relationshipType,
        sourceConceptId: input.sourceConceptId,
        targetConceptId: input.targetConceptId,
      };
    }),
  };

  if (!found) {
    throw new ArtifactApprovalInvalidStateError('Knowledgebase relationship was not found.');
  }

  return knowledgebaseArtifactContentDto.parse({
    ...content,
    graphProjection: projectKnowledgebaseGraph(knowledgebase),
    knowledgebase,
  });
}
