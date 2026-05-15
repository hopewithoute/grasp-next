import { mastra } from '@grasp/ai';
import { processConceptExtraction, type ConceptExtractionWorkflow } from '@grasp/domain';
import type {
  createArtifactRepository,
  createArtifactReviewRunRepository,
  createAuditLogRepository,
  createConceptRepository,
  createProjectRepository,
} from '@grasp/db';
import { parseReviewConceptsSuspendPayload } from './suspend-payload.js';
import type { ConceptExtractionJob } from '../concept-extraction-queue.js';

export type ProcessConceptExtractionJobDeps = {
  artifactRepository: ReturnType<typeof createArtifactRepository>;
  artifactReviewRunRepository: ReturnType<typeof createArtifactReviewRunRepository>;
  auditLogRepository: ReturnType<typeof createAuditLogRepository>;
  conceptRepository: ReturnType<typeof createConceptRepository>;
  projectRepository: ReturnType<typeof createProjectRepository>;
};

export async function processConceptExtractionJob(
  job: ConceptExtractionJob,
  deps: ProcessConceptExtractionJobDeps
) {
  const project = await deps.projectRepository.findById(job.projectId);

  if (!project) {
    throw new Error(`Project not found: ${job.projectId}`);
  }

  const workflowAdapter: ConceptExtractionWorkflow = {
    runAndSuspend: async ({ sourceMaterial }) => {
      const extractWorkflow = mastra.getWorkflow('extractConceptsWorkflow');
      const workflowRun = await extractWorkflow.createRun({
        resourceId: project.id,
      });
      const workflowResult = await workflowRun.start({
        inputData: { sourceMaterial },
      });

      if (workflowResult.status !== 'suspended') {
        throw new Error(`concept_extraction_workflow_unexpected_status:${workflowResult.status}`);
      }

      const suspendPayload = parseReviewConceptsSuspendPayload(workflowResult.suspendPayload);

      return {
        conceptGraph: suspendPayload.conceptGraph,
        extractionMode: suspendPayload.extractionMode,
        workflowRunId: workflowRun.runId,
        suspendedSteps: workflowResult.suspended,
        resumeLabels: workflowResult.resumeLabels ?? null,
      };
    },
  };

  await processConceptExtraction(
    {
      projectId: project.id,
      sourceMaterial: project.sourceMaterial ?? '',
      ownerId: project.ownerId,
      revisionFeedback: job.revisionFeedback,
    },
    {
      artifactRepository: deps.artifactRepository,
      artifactReviewRunRepository: deps.artifactReviewRunRepository,
      auditLogRepository: deps.auditLogRepository,
      conceptRepository: deps.conceptRepository,
      projectRepository: deps.projectRepository,
      conceptExtractionWorkflow: workflowAdapter,
    }
  );
}
