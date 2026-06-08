import { Mastra } from '@mastra/core';
import { ConsoleLogger } from '@mastra/core/logger';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { ingestionAgent } from '../ingestion/ingestion.agent';
import { linkAdjudicatorAgent } from '../ingestion/link-adjudicator.agent';
import { sourceIngestionWorkflow } from '../ingestion/source-ingestion.workflow';
import { sourceLinkingWorkflow } from '../ingestion/source-linking.workflow';
import { refinementAgent } from '../refinement/refinement-agent';
import { setupGlobalLlmQueue } from './llm-queue';
import { getMastraStorage } from './storage';

export { robustStream } from './stream-utils';

// Apply global rate limiting to all outgoing LLM requests before initializing Mastra
setupGlobalLlmQueue();

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'grasp-local',
        exporters: [new MastraStorageExporter()],
      },
    },
  }),
  logger: new ConsoleLogger({ level: 'warn' }),
  agents: {
    linkAdjudicatorAgent,
    ingestionAgent,
    refinementAgent,
  },
  storage: getMastraStorage(),
  workflows: {
    sourceLinkingWorkflow,
    sourceIngestionWorkflow,
  },
});
