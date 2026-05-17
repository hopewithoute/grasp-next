import 'server-only';

import { mastra, parseReviewConceptsSuspendPayload } from '@grasp/ai';
import {
  CONCEPT_EXTRACTION_WORKFLOW,
  processConceptExtraction,
  type ConceptExtractionWorkflow,
} from '@grasp/domain';
import type { createProjectDeps } from './project-deps';

type ProjectDeps = ReturnType<typeof createProjectDeps>;

export type ConceptGraphWorkspaceEvent =
  | { type: 'assistant_message'; text: string }
  | { type: 'source_read'; sourceId: string; title?: string }
  | { type: 'concept_proposed'; name: string; definition?: string }
  | {
      type: 'relationship_proposed';
      source: string;
      target: string;
      relationshipType: 'prerequisite';
    }
  | { type: 'evidence_attached'; concept: string; excerpt: string; location?: string }
  | { type: 'graph_version_created'; artifactVersionId: string }
  | { type: 'review_ready'; artifactId: string };

export async function runProjectConceptExtraction(
  input: {
    instruction?: string | null;
    onEvent?: (event: ConceptGraphWorkspaceEvent) => Promise<void> | void;
    projectId: string;
    revisionFeedback?: string | null;
  },
  deps: ProjectDeps
) {
  const project = await deps.projectRepository.findById(input.projectId);

  if (!project) {
    throw new Error(`Project not found: ${input.projectId}`);
  }

  const workflowAdapter: ConceptExtractionWorkflow = {
    runAndSuspend: async ({ sourceMaterial }) => {
      await emit(input.onEvent, {
        text: 'I am reading the current source context and looking for teachable concepts.',
        type: 'assistant_message',
      });
      await emit(input.onEvent, {
        sourceId: project.id,
        title: project.title,
        type: 'source_read',
      });

      const extractWorkflow = mastra.getWorkflow(CONCEPT_EXTRACTION_WORKFLOW.REGISTRY_NAME);
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

      await emit(input.onEvent, {
        text: `I found ${suspendPayload.conceptGraph.concepts.length} concepts and ${suspendPayload.conceptGraph.relationships.length} prerequisite links.`,
        type: 'assistant_message',
      });

      for (const concept of suspendPayload.conceptGraph.concepts) {
        await emit(input.onEvent, {
          definition: concept.definition,
          name: concept.name,
          type: 'concept_proposed',
        });

        for (const evidence of concept.sourceEvidence) {
          await emit(input.onEvent, {
            concept: concept.name,
            excerpt: evidence.excerpt,
            location: evidence.location,
            type: 'evidence_attached',
          });
        }
      }

      for (const relationship of suspendPayload.conceptGraph.relationships) {
        await emit(input.onEvent, {
          relationshipType: relationship.relationshipType,
          source: relationship.sourceConceptName,
          target: relationship.targetConceptName,
          type: 'relationship_proposed',
        });
      }

      return {
        conceptGraph: suspendPayload.conceptGraph,
        extractionMode: suspendPayload.extractionMode,
        resumeLabels: workflowResult.resumeLabels ?? null,
        suspendedSteps: workflowResult.suspended,
        workflowRunId: workflowRun.runId,
      };
    },
  };

  await emit(input.onEvent, {
    text: input.instruction
      ? `I will apply your instruction: "${input.instruction}"`
      : 'I will build a reviewable concept graph from the current source.',
    type: 'assistant_message',
  });

  const result = await processConceptExtraction(
    {
      ownerId: project.ownerId,
      projectId: project.id,
      revisionFeedback: input.revisionFeedback,
      sourceMaterial: project.sourceMaterial ?? '',
    },
    {
      artifactRepository: deps.artifactRepository,
      artifactReviewRunRepository: deps.artifactReviewRunRepository,
      auditLogRepository: deps.auditLogRepository,
      conceptRepository: deps.conceptRepository,
      conceptExtractionWorkflow: workflowAdapter,
      projectRepository: deps.projectRepository,
    }
  );

  await emit(input.onEvent, {
    artifactVersionId: result.artifactVersionId,
    type: 'graph_version_created',
  });
  await emit(input.onEvent, {
    artifactId: result.artifactId,
    type: 'review_ready',
  });
  await emit(input.onEvent, {
    text: 'The concept graph is ready. Review the artifact on the right before approving it.',
    type: 'assistant_message',
  });

  return result;
}

async function emit(
  onEvent: ((event: ConceptGraphWorkspaceEvent) => Promise<void> | void) | undefined,
  event: ConceptGraphWorkspaceEvent
) {
  if (onEvent) {
    await onEvent(event);
  }
}
