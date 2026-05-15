import { canEditOwnedProject, type Actor } from '../projects/project.policy';
import type {
  AuditLogRepository,
  ConceptExtractionQueue,
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
  conceptExtractionQueue: ConceptExtractionQueue;
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

  if (artifact.type !== 'concept_graph') {
    throw new ArtifactApprovalInvalidStateError(
      'Only concept graph artifacts can request concept revision.'
    );
  }

  if (artifact.status !== 'generated' && artifact.status !== 'needs_revision') {
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

  if (reviewRun.status !== 'suspended') {
    throw new ArtifactApprovalInvalidStateError('Artifact review run is not suspended.');
  }

  await deps.artifactReviewRunRepository.updateStatus(reviewRun.id, 'resumed');

  const revisedArtifact = await deps.artifactRepository.updateStatus(artifact.id, 'needs_revision');

  if (!revisedArtifact) {
    throw new ArtifactNotFoundError();
  }

  await deps.projectRepository.updateStatus(project.id, 'processing');

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: 'artifact.revision_requested',
    entityType: 'artifact',
    entityId: revisedArtifact.id,
    metadata: {
      artifactVersionId: artifact.currentVersionId,
      reviewRunId: reviewRun.id,
      revisionFeedback: dto.revisionFeedback,
      workflowId: reviewRun.workflowId,
      workflowRunId: reviewRun.workflowRunId,
    },
  });

  await deps.conceptExtractionQueue.enqueueConceptExtraction({
    projectId: project.id,
    revisionFeedback: dto.revisionFeedback,
  });

  return revisedArtifact;
}
