import { extractConceptsWorkflow } from './extract-concepts-workflow';
import { mastra } from '../index';

export type ResumeArtifactReviewInput = {
  resumeLabel: string;
  workflowId: string;
  workflowRunId: string;
};

export type ResumeArtifactReviewResult = {
  status: 'success' | 'suspended' | 'failed' | 'unknown';
};

export async function resumeArtifactReview(
  input: ResumeArtifactReviewInput
): Promise<ResumeArtifactReviewResult> {
  if (input.workflowId !== extractConceptsWorkflow.id) {
    throw new Error(`Unsupported artifact review workflow: ${input.workflowId}`);
  }

  const workflow = mastra.getWorkflow('extractConceptsWorkflow');
  const run = await workflow.createRun({
    runId: input.workflowRunId,
  });
  const result = await run.resume({
    label: input.resumeLabel,
    resumeData: {
      approved: true,
    },
  });

  if (result.status === 'success' || result.status === 'suspended' || result.status === 'failed') {
    return {
      status: result.status,
    };
  }

  return {
    status: 'unknown',
  };
}
