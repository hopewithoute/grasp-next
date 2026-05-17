import { canEditOwnedProject, type Actor } from '../projects/project.policy';
import {
  ARTIFACT_REVIEW_RUN_STATUS,
  ARTIFACT_STATUS,
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
} from '../constants';
import type {
  ArtifactRecord,
  ArtifactRepository,
  ArtifactReviewRunRepository,
} from './artifact.types';
import type { AuditLogRepository, ProjectRepository } from '../projects/project.types';
import { approveArtifactDto, type ApproveArtifactInput } from './approve-artifact.dto';

export type ArtifactReviewWorkflow = {
  resumeReview(input: {
    resumeLabel: string;
    workflowId: string;
    workflowRunId: string;
  }): Promise<{ status: 'success' | 'suspended' | 'failed' | 'unknown' }>;
};

export type ApproveArtifactDeps = {
  artifactRepository: ArtifactRepository;
  artifactReviewRunRepository: ArtifactReviewRunRepository;
  auditLogRepository: AuditLogRepository;
  projectRepository: ProjectRepository;
  reviewWorkflow: ArtifactReviewWorkflow;
};

export class ArtifactNotFoundError extends Error {
  constructor() {
    super('Artifact not found.');
    this.name = 'ArtifactNotFoundError';
  }
}

export class ArtifactApprovalForbiddenError extends Error {
  constructor() {
    super('Forbidden.');
    this.name = 'ArtifactApprovalForbiddenError';
  }
}

export class ArtifactApprovalInvalidStateError extends Error {
  constructor(message = 'Artifact cannot be approved in its current state.') {
    super(message);
    this.name = 'ArtifactApprovalInvalidStateError';
  }
}

export class ArtifactApprovalReviewRunNotFoundError extends Error {
  constructor() {
    super('Artifact review run not found.');
    this.name = 'ArtifactApprovalReviewRunNotFoundError';
  }
}

export async function approveArtifact(
  input: ApproveArtifactInput,
  deps: ApproveArtifactDeps,
  actor: Actor
): Promise<ArtifactRecord> {
  const dto = approveArtifactDto.parse(input);
  const artifact = await deps.artifactRepository.findById(dto.artifactId);

  if (!artifact) {
    throw new ArtifactNotFoundError();
  }

  const project = await deps.projectRepository.findById(artifact.projectId);

  if (!canEditOwnedProject(actor, project)) {
    throw new ArtifactApprovalForbiddenError();
  }

  if (
    artifact.status !== ARTIFACT_STATUS.GENERATED &&
    artifact.status !== ARTIFACT_STATUS.NEEDS_REVISION
  ) {
    throw new ArtifactApprovalInvalidStateError();
  }

  if (!artifact.currentVersionId) {
    throw new ArtifactApprovalInvalidStateError('Artifact has no current version to approve.');
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

  const workflowResult = await deps.reviewWorkflow.resumeReview({
    resumeLabel: reviewRun.resumeLabel,
    workflowId: reviewRun.workflowId,
    workflowRunId: reviewRun.workflowRunId,
  });

  if (workflowResult.status !== 'success') {
    await deps.artifactReviewRunRepository.updateStatus(
      reviewRun.id,
      ARTIFACT_REVIEW_RUN_STATUS.FAILED
    );
    throw new ArtifactApprovalInvalidStateError(
      `Artifact review workflow did not complete: ${workflowResult.status}`
    );
  }

  await deps.artifactReviewRunRepository.updateStatus(
    reviewRun.id,
    ARTIFACT_REVIEW_RUN_STATUS.COMPLETED
  );

  const approvedArtifact = await deps.artifactRepository.updateStatus(
    artifact.id,
    ARTIFACT_STATUS.APPROVED
  );

  if (!approvedArtifact) {
    throw new ArtifactNotFoundError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: AUDIT_ACTION.ARTIFACT_APPROVED,
    entityType: AUDIT_ENTITY_TYPE.ARTIFACT,
    entityId: approvedArtifact.id,
    metadata: {
      artifactVersionId: artifact.currentVersionId,
      reviewRunId: reviewRun.id,
      workflowId: reviewRun.workflowId,
      workflowRunId: reviewRun.workflowRunId,
    },
  });

  return approvedArtifact;
}
