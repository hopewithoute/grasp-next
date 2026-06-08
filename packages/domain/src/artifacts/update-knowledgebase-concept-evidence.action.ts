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
import { type UpdateKnowledgebaseConceptEvidenceInput } from './update-knowledgebase-concept-evidence.dto';

export type UpdateKnowledgebaseConceptEvidenceDeps = {
  artifactRepository: ArtifactRepository;
  auditLogRepository: AuditLogRepository;
  knowledgebaseRepository: KnowledgebaseRepository;
  projectRepository: ProjectRepository;
};

export async function updateKnowledgebaseConceptEvidence(
  input: UpdateKnowledgebaseConceptEvidenceInput,
  deps: UpdateKnowledgebaseConceptEvidenceDeps,
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
      'Only concept graph artifacts can update knowledgebase evidence.'
    );
  }

  if (
    artifact.status !== ARTIFACT_STATUS.GENERATED &&
    artifact.status !== ARTIFACT_STATUS.NEEDS_REVISION
  ) {
    throw new ArtifactApprovalInvalidStateError(
      'Knowledgebase evidence can only be edited while the artifact is under review.'
    );
  }

  if (!artifact.currentVersionId) {
    throw new ArtifactApprovalInvalidStateError('Artifact has no current version to edit.');
  }

  const currentVersion = await findCurrentVersion(deps.artifactRepository, artifact);
  const currentContent = parse(knowledgebaseArtifactContentDto, currentVersion.content);
  const nextContent = patchKnowledgebaseConceptEvidence(currentContent, {
    blockId: input.blockId,
    conceptId: input.conceptId,
    locationLabel: input.locationLabel,
    originalBlockId: input.originalBlockId,
    originalQuote: input.originalQuote,
    originalSourceId: input.originalSourceId,
    quote: input.quote,
    sourceId: input.sourceId,
  });

  const nextVersion = await deps.artifactRepository.createVersion({
    artifactId: artifact.id,
    content: nextContent,
    extractionMode: currentVersion.extractionMode,
    revisionFeedback: `Manual knowledgebase evidence update: ${input.conceptId}`,
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
    action: AUDIT_ACTION.ARTIFACT_KNOWLEDGEBASE_EVIDENCE_UPDATED,
    entityType: AUDIT_ENTITY_TYPE.ARTIFACT,
    entityId: updatedArtifact.id,
    metadata: {
      blockId: input.blockId,
      conceptId: input.conceptId,
      nextArtifactVersionId: nextVersion.id,
      originalBlockId: input.originalBlockId,
      originalSourceId: input.originalSourceId,
      previousArtifactVersionId: currentVersion.id,
      sourceId: input.sourceId,
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

function patchKnowledgebaseConceptEvidence(
  content: KnowledgebaseArtifactContentDto,
  input: {
    blockId: string;
    conceptId: string;
    locationLabel: string;
    originalBlockId: string;
    originalQuote: string;
    originalSourceId: string;
    quote: string;
    sourceId: string;
  }
): KnowledgebaseArtifactContentDto {
  const block = content.normalizedSource.blocks.find(
    (candidate) => candidate.id === input.blockId && candidate.sourceId === input.sourceId
  );

  if (!block) {
    throw new ArtifactApprovalInvalidStateError('Evidence source block was not found.');
  }

  if (!block.text.includes(input.quote)) {
    throw new ArtifactApprovalInvalidStateError(
      'Evidence quote must be an exact substring of the selected source block.'
    );
  }

  let found = false;
  const knowledgebase = {
    ...content.knowledgebase,
    concepts: content.knowledgebase.concepts.map((concept) => {
      if (concept.id !== input.conceptId) {
        return concept;
      }

      const refIndex = concept.sourceRefs.findIndex((ref) => isSameSourceRef(ref, input));

      if (refIndex === -1) {
        throw new ArtifactApprovalInvalidStateError('Knowledgebase evidence ref was not found.');
      }

      found = true;
      return {
        ...concept,
        sourceRefs: concept.sourceRefs.map((ref, index) =>
          index === refIndex
            ? {
                blockId: input.blockId,
                locationLabel: input.locationLabel,
                quote: input.quote,
                sourceId: input.sourceId,
              }
            : ref
        ),
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

function isSameSourceRef(
  ref: { blockId: string; quote: string; sourceId: string },
  input: { originalBlockId: string; originalQuote: string; originalSourceId: string }
) {
  return (
    ref.sourceId === input.originalSourceId &&
    ref.blockId === input.originalBlockId &&
    ref.quote === input.originalQuote
  );
}
