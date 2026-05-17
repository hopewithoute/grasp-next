import { canEditOwnedProject, type Actor } from '../projects/project.policy';
import {
  ARTIFACT_REVIEW_RUN_STATUS,
  ARTIFACT_STATUS,
  ARTIFACT_TYPE,
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
} from '../constants';
import type {
  AuditLogRepository,
  ProjectRepository,
} from '../projects/project.types';
import type {
  ArtifactRecord,
  ArtifactRepository,
  ArtifactReviewRunRepository,
} from './artifact.types';
import {
  ArtifactApprovalForbiddenError,
  ArtifactApprovalInvalidStateError,
  ArtifactApprovalReviewRunNotFoundError,
  ArtifactNotFoundError,
} from './approve-artifact.action';
import {
  requestConceptRevisionDto,
  type RequestConceptRevisionInput,
} from './request-concept-revision.dto';

export type RequestConceptRevisionDeps = {
  artifactRepository: ArtifactRepository;
  artifactReviewRunRepository: ArtifactReviewRunRepository;
  auditLogRepository: AuditLogRepository;
  projectRepository: ProjectRepository;
};

export async function requestConceptRevision(
  input: RequestConceptRevisionInput,
  deps: RequestConceptRevisionDeps,
  actor: Actor
): Promise<ArtifactRecord> {
  const dto = requestConceptRevisionDto.parse(input);
  const artifact = await deps.artifactRepository.findById(dto.artifactId);

  if (!artifact) {
    throw new ArtifactNotFoundError();
  }

  const project = await deps.projectRepository.findById(artifact.projectId);

  if (!canEditOwnedProject(actor, project)) {
    throw new ArtifactApprovalForbiddenError();
  }

  if (!project) {
    throw new ArtifactApprovalForbiddenError();
  }

  if (artifact.type !== ARTIFACT_TYPE.CONCEPT_GRAPH) {
    throw new ArtifactApprovalInvalidStateError(
      'Only concept graph artifacts can request concept revision.'
    );
  }

  if (
    artifact.status !== ARTIFACT_STATUS.GENERATED &&
    artifact.status !== ARTIFACT_STATUS.NEEDS_REVISION
  ) {
    throw new ArtifactApprovalInvalidStateError();
  }

  if (!artifact.currentVersionId) {
    throw new ArtifactApprovalInvalidStateError('Artifact has no current version to revise.');
  }

  const reviewRun = await deps.artifactReviewRunRepository.findByArtifactVersionId(
    artifact.currentVersionId
  );

  if (!reviewRun) {
    throw new ArtifactApprovalReviewRunNotFoundError();
  }

  if (reviewRun.status !== ARTIFACT_REVIEW_RUN_STATUS.SUSPENDED) {
    throw new ArtifactApprovalInvalidStateError('Artifact review run is not suspended.');
  }

  await deps.artifactReviewRunRepository.updateStatus(
    reviewRun.id,
    ARTIFACT_REVIEW_RUN_STATUS.RESUMED
  );

  const revisedArtifact = await deps.artifactRepository.updateStatus(
    artifact.id,
    ARTIFACT_STATUS.NEEDS_REVISION
  );

  if (!revisedArtifact) {
    throw new ArtifactNotFoundError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: AUDIT_ACTION.ARTIFACT_REVISION_REQUESTED,
    entityType: AUDIT_ENTITY_TYPE.ARTIFACT,
    entityId: revisedArtifact.id,
    metadata: {
      artifactVersionId: artifact.currentVersionId,
      reviewRunId: reviewRun.id,
      revisionFeedback: dto.revisionFeedback,
      workflowId: reviewRun.workflowId,
      workflowRunId: reviewRun.workflowRunId,
    },
  });

  return revisedArtifact;
}
