import 'server-only';
import { IngestionAiAdapter, sourceIngestionWorkflow } from '@grasp/ai/ingestion';
import type {
  IngestionRunRepository,
  IngestionStreamEvent,
  KnowledgebaseRepository,
} from '@grasp/domain';

export type SourceIngestionDeps = {
  ingestionRunRepository: IngestionRunRepository;
  knowledgebaseRepository: KnowledgebaseRepository;
};

type SourceIngestionWorkflowInput = {
  content: string;
  ingestionRunId: string;
  projectId: string;
  sourceId: string;
  sourceTitle: string;
};

export type { IngestionStreamEvent };

const INGESTION_EVENTS = new Set([
  'ingestion_started',
  'chunk_processing',
  'agent_thinking',
  'retrieval_activity',
  'concept_extracted',
  'link_applied',
  'link_candidate_generated',
  'link_candidate_reviewed',
  'link_policy_applied',
  'link_rejected',
  'relation_claim_extracted',
  'relationship_extracted',
  'evidence_dropped',
  'ingestion_complete',
  'ingestion_failed',
]);

export async function runSourceIngestion(
  input: {
    content: string;
    onEvent?: (event: IngestionStreamEvent) => void;
    projectId: string;
    sourceId: string;
    sourceTitle: string;
    sourceType: 'markdown' | 'text' | 'web';
  },
  deps: SourceIngestionDeps
) {
  const aiAdapter = new IngestionAiAdapter(deps.knowledgebaseRepository);
  const ingestionRun = await deps.ingestionRunRepository.create({
    projectId: input.projectId,
    sourceId: input.sourceId,
  });

  const depsMap: Record<string, unknown> = {
    aiPort: aiAdapter,
    ingestionRunRepository: deps.ingestionRunRepository,
    knowledgebaseRepository: deps.knowledgebaseRepository,
  };
  
  const requestContext = {
    get: (key: string) => depsMap[key],
    size: () => 3,
    forEach: (cb: any) => Object.entries(depsMap).forEach(([k, v]) => cb(v, k)),
    entries: () => Object.entries(depsMap),
    keys: () => Object.keys(depsMap),
    values: () => Object.values(depsMap),
    has: (key: string) => key in depsMap,
    [Symbol.iterator]: function* () {
      yield* Object.entries(depsMap);
    }
  } as unknown as Map<string, unknown>;

  const run = await sourceIngestionWorkflow.createRun();
  const inputData: SourceIngestionWorkflowInput = {
    ingestionRunId: ingestionRun.id,
    projectId: input.projectId,
    sourceId: input.sourceId,
    sourceTitle: input.sourceTitle,
    content: input.content,
  };

  try {
    if (input.onEvent) {
      const stream = await run.stream({
        inputData,
        requestContext,
      } as unknown as Parameters<typeof run.stream>[0]);

      for await (const chunk of stream) {
        if (
          chunk &&
          typeof chunk === 'object' &&
          'type' in chunk &&
          chunk.type === 'workflow-finish' &&
          'payload' in chunk &&
          chunk.payload &&
          typeof chunk.payload === 'object' &&
          'workflowStatus' in chunk.payload &&
          chunk.payload.workflowStatus === 'failed'
        ) {
          input.onEvent({
            type: 'ingestion_failed',
            reason:
              ((chunk.payload as any).metadata?.errorMessage as string) ??
              'Workflow failed unexpectedly',
          });
          continue;
        }

        const isStepOutput = chunk.type === 'workflow-step-output';
        const isStepResult = chunk.type === 'workflow-step-result';

        if (
          chunk &&
          typeof chunk === 'object' &&
          'type' in chunk &&
          (isStepOutput || isStepResult) &&
          'payload' in chunk &&
          chunk.payload &&
          typeof chunk.payload === 'object' &&
          'output' in chunk.payload &&
          chunk.payload.output &&
          typeof chunk.payload.output === 'object' &&
          'type' in chunk.payload.output &&
          typeof chunk.payload.output.type === 'string' &&
          INGESTION_EVENTS.has(chunk.payload.output.type)
        ) {
          input.onEvent(chunk.payload.output as unknown as IngestionStreamEvent);
        }
      }

      return null; // The stream doesn't directly return the workflow output
    } else {
      return await run.start({
        inputData,
        requestContext,
      } as unknown as Parameters<typeof run.start>[0]);
    }
  } catch (error) {
    await deps.ingestionRunRepository.markFailed(
      ingestionRun.id,
      error instanceof Error ? error.message : 'Unknown ingestion error'
    );
    throw error;
  }
}
