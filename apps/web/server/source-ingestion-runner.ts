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
    sourceType: 'markdown' | 'text';
  },
  deps: SourceIngestionDeps
) {
  const aiAdapter = new IngestionAiAdapter(deps.knowledgebaseRepository);

  const requestContext = new Map<string, unknown>([
    ['aiPort', aiAdapter],
    ['ingestionRunRepository', deps.ingestionRunRepository],
    ['knowledgebaseRepository', deps.knowledgebaseRepository],
  ]);

  const run = await sourceIngestionWorkflow.createRun();
  const inputData: SourceIngestionWorkflowInput = {
    projectId: input.projectId,
    sourceId: input.sourceId,
    sourceTitle: input.sourceTitle,
    content: input.content,
  };

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
        chunk.type === 'workflow-step-output' &&
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
}
