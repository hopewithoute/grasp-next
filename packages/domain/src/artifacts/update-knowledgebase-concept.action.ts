import { ARTIFACT_STATUS, ARTIFACT_TYPE, AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants';
import {
  knowledgebaseArtifactContentDto,
  projectKnowledgebaseGraph,
  type KnowledgebaseArtifactContentDto,
} from '../knowledgebase';
import type { KnowledgebaseRepository } from '../knowledgebase';
import { canEditOwnedProject, type Actor } from '../projects/project.policy';
import type { AuditLogRepository, ProjectRepository } from '../projects/project.types';
import { parse } from '../validation';
import {
  ArtifactApprovalForbiddenError,
  ArtifactApprovalInvalidStateError,
  ArtifactNotFoundError,
} from './approve-artifact.action';
import type { ArtifactRecord, ArtifactRepository } from './artifact.types';
import { type UpdateKnowledgebaseConceptInput } from './update-knowledgebase-concept.dto';

export type UpdateKnowledgebaseConceptDeps = {
  artifactRepository: ArtifactRepository;
  auditLogRepository: AuditLogRepository;
  knowledgebaseRepository: KnowledgebaseRepository;
  projectRepository: ProjectRepository;
};

export async function updateKnowledgebaseConcept(
  input: UpdateKnowledgebaseConceptInput,
  deps: UpdateKnowledgebaseConceptDeps,
  actor: Actor
): Promise<ArtifactRecord> {
  const artifact = await deps.artifactRepository.findById(input.artifactId);

  if (!artifact) {
    throw new ArtifactNotFoundError();
  }

  const project = await deps.projectRepository.findById(artifact.projectId);

  if (!canEditOwnedProject(actor, project)) {
    throw new ArtifactApprovalForbiddenError();
  }

  if (artifact.type !== ARTIFACT_TYPE.CONCEPT_GRAPH) {
    throw new ArtifactApprovalInvalidStateError(
      'Only concept graph artifacts can update knowledgebase concepts.'
    );
  }

  if (
    artifact.status !== ARTIFACT_STATUS.GENERATED &&
    artifact.status !== ARTIFACT_STATUS.NEEDS_REVISION
  ) {
    throw new ArtifactApprovalInvalidStateError(
      'Knowledgebase concepts can only be edited while the artifact is under review.'
    );
  }

  if (!artifact.currentVersionId) {
    throw new ArtifactApprovalInvalidStateError('Artifact has no current version to edit.');
  }

  const currentVersion = await findCurrentVersion(deps.artifactRepository, artifact);
  const currentContent = parse(knowledgebaseArtifactContentDto, currentVersion.content);
  const nextContent = patchKnowledgebaseConcept(currentContent, {
    conceptId: input.conceptId,
    definition: input.definition,
    difficulty: input.difficulty,
    name: input.name,
  });

  const nextVersion = await deps.artifactRepository.createVersion({
    artifactId: artifact.id,
    content: nextContent,
    extractionMode: currentVersion.extractionMode,
    revisionFeedback: `Manual knowledgebase concept update: ${input.name}`,
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
    action: AUDIT_ACTION.ARTIFACT_KNOWLEDGEBASE_CONCEPT_UPDATED,
    entityType: AUDIT_ENTITY_TYPE.ARTIFACT,
    entityId: updatedArtifact.id,
    metadata: {
      conceptId: input.conceptId,
      nextArtifactVersionId: nextVersion.id,
      previousArtifactVersionId: currentVersion.id,
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

function patchKnowledgebaseConcept(
  content: KnowledgebaseArtifactContentDto,
  input: {
    conceptId: string;
    definition: string;
    difficulty: KnowledgebaseArtifactContentDto['knowledgebase']['concepts'][number]['difficulty'];
    name: string;
  }
): KnowledgebaseArtifactContentDto {
  let found = false;
  const knowledgebase = {
    ...content.knowledgebase,
    concepts: content.knowledgebase.concepts.map((concept) => {
      if (concept.id !== input.conceptId) {
        return concept;
      }

      found = true;
      return {
        ...concept,
        definition: input.definition,
        difficulty: input.difficulty,
        name: input.name,
      };
    }),
  };

  if (!found) {
    throw new ArtifactApprovalInvalidStateError('Knowledgebase concept was not found.');
  }

  return {
    ...content,
    graphProjection: projectKnowledgebaseGraph(knowledgebase),
    knowledgebase,
  };
}
