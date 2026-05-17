import {
  ARTIFACT_STATUS,
  ARTIFACT_TYPE,
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  CONCEPT_EXTRACTION_WORKFLOW,
  PROJECT_STATUS,
} from '../constants';
import {
  processConceptExtractionDto,
  type ProcessConceptExtractionInput,
} from './process-concept-extraction.dto';
import type {
  ProcessConceptExtractionDeps,
  ProcessConceptExtractionResult,
} from './process-concept-extraction.types';

export async function processConceptExtraction(
  input: ProcessConceptExtractionInput,
  deps: ProcessConceptExtractionDeps
): Promise<ProcessConceptExtractionResult> {
  const dto = processConceptExtractionDto.parse(input);

  try {
    const sourceMaterial = buildExtractionSourceMaterial(dto.sourceMaterial, dto.revisionFeedback);

    const workflowResult = await deps.conceptExtractionWorkflow.runAndSuspend({
      sourceMaterial,
      projectId: dto.projectId,
    });

    const artifact = await deps.artifactRepository.findOrCreateForProject({
      projectId: dto.projectId,
      status: ARTIFACT_STATUS.GENERATING,
      type: ARTIFACT_TYPE.CONCEPT_GRAPH,
    });

    const artifactVersion = await deps.artifactRepository.createVersion({
      artifactId: artifact.id,
      content: workflowResult.conceptGraph,
      extractionMode: workflowResult.extractionMode,
      revisionFeedback: dto.revisionFeedback ?? null,
    });

    const reviewRun = await deps.artifactReviewRunRepository.createSuspended({
      artifactId: artifact.id,
      artifactVersionId: artifactVersion.id,
      resumeLabel: CONCEPT_EXTRACTION_WORKFLOW.REVIEW_RESUME_LABEL,
      resumeLabels: workflowResult.resumeLabels,
      suspendedSteps: workflowResult.suspendedSteps,
      workflowId: CONCEPT_EXTRACTION_WORKFLOW.ID,
      workflowRunId: workflowResult.workflowRunId,
    });

    await deps.conceptRepository.replaceForProject(dto.projectId, {
      concepts: workflowResult.conceptGraph.concepts.map((concept) => ({
        ...concept,
        confidence: concept.confidence.toFixed(2),
      })),
      relationships: workflowResult.conceptGraph.relationships,
    });

    await deps.artifactRepository.updateStatus(artifact.id, ARTIFACT_STATUS.GENERATED);
    const updatedProject = await deps.projectRepository.updateStatus(
      dto.projectId,
      PROJECT_STATUS.REVIEWING
    );

    await deps.auditLogRepository.write({
      actorId: dto.ownerId,
      action: AUDIT_ACTION.PROJECT_CONCEPT_EXTRACTION_COMPLETED,
      entityType: AUDIT_ENTITY_TYPE.PROJECT,
      entityId: dto.projectId,
      metadata: {
        artifactId: artifact.id,
        artifactVersionId: artifactVersion.id,
        artifactReviewRunId: reviewRun.id,
        conceptCount: workflowResult.conceptGraph.concepts.length,
        relationshipCount: workflowResult.conceptGraph.relationships.length,
        extractionMode: workflowResult.extractionMode,
        revisionFeedback: dto.revisionFeedback ?? null,
        workflowRunId: workflowResult.workflowRunId,
        status: updatedProject?.status ?? PROJECT_STATUS.REVIEWING,
      },
    });

    return {
      artifactId: artifact.id,
      artifactVersionId: artifactVersion.id,
      reviewRunId: reviewRun.id,
      conceptCount: workflowResult.conceptGraph.concepts.length,
      relationshipCount: workflowResult.conceptGraph.relationships.length,
      extractionMode: workflowResult.extractionMode,
    };
  } catch (error) {
    await deps.projectRepository.updateStatus(dto.projectId, PROJECT_STATUS.FAILED);

    const artifact = await deps.artifactRepository.findByProjectAndType(
      dto.projectId,
      ARTIFACT_TYPE.CONCEPT_GRAPH
    );

    if (artifact) {
      await deps.artifactRepository.updateStatus(artifact.id, ARTIFACT_STATUS.FAILED);
    }

    await deps.auditLogRepository.write({
      actorId: dto.ownerId,
      action: AUDIT_ACTION.PROJECT_CONCEPT_EXTRACTION_FAILED,
      entityType: AUDIT_ENTITY_TYPE.PROJECT,
      entityId: dto.projectId,
      metadata: {
        reason: error instanceof Error ? error.message : 'unknown_error',
      },
    });

    throw error;
  }
}

function buildExtractionSourceMaterial(
  sourceMaterial: string,
  revisionFeedback: string | null | undefined
) {
  const feedback = revisionFeedback?.trim();

  if (!feedback) {
    return sourceMaterial;
  }

  return [sourceMaterial, '', 'Revision instructions from the creator:', feedback].join('\n');
}
