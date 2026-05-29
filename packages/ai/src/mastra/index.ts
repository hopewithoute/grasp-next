import { Mastra } from '@mastra/core';
export { robustStream } from './stream-utils';
import { ConsoleLogger } from '@mastra/core/logger';

import { getMastraStorage } from './storage';
import { linkAdjudicatorAgent } from '../ingestion/link-adjudicator-agent';
import { ingestionAgent } from '../ingestion/ingestion-agent';
import { sourceLinkingWorkflow } from '../ingestion/source-linking-workflow';
import { refinementAgent } from '../refinement/refinement-agent';

export const mastra = new Mastra({
  logger: new ConsoleLogger({ level: 'warn' }),
  agents: {
    linkAdjudicatorAgent,
    ingestionAgent,
    refinementAgent,
  },
  storage: getMastraStorage(),
  workflows: {
    sourceLinkingWorkflow,
  },
});
