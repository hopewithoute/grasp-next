import { Mastra } from '@mastra/core';
import { Observability, MastraStorageExporter } from '@mastra/observability';
export { robustStream } from './stream-utils';
import { ConsoleLogger } from '@mastra/core/logger';
import { setupGlobalLlmQueue } from './llm-queue';

import { getMastraStorage } from './storage';
import { linkAdjudicatorAgent } from '../ingestion/link-adjudicator.agent';

// Apply global rate limiting to all outgoing LLM requests before initializing Mastra
setupGlobalLlmQueue();
import { ingestionAgent } from '../ingestion/ingestion.agent';
import { sourceLinkingWorkflow } from '../ingestion/source-linking.workflow';
import { sourceIngestionWorkflow } from '../ingestion/source-ingestion.workflow';
import { refinementAgent } from '../refinement/refinement-agent';

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

