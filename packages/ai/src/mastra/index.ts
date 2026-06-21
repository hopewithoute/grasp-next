import { Mastra } from '@mastra/core';
import { ConsoleLogger } from '@mastra/core/logger';
import { MastraStorageExporter, Observability } from '@mastra/observability';
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
    refinementAgent,
  },
  storage: getMastraStorage(),
  workflows: {},
});
