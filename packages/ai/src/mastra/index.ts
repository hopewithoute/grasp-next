import { Mastra } from '@mastra/core';
import { loadAiEnv } from '../load-env';
import { createOpenAICompatibleGatewayFromEnv } from './openai-compatible-gateway';
import { createMastraStorage } from './storage';
import { linkAdjudicatorAgent } from '../ingestion/link-adjudicator-agent';
import { ingestionAgent } from '../ingestion/ingestion-agent';
import { sourceLinkingWorkflow } from '../ingestion/source-linking-workflow';
import { refinementAgent } from '../refinement/refinement-agent';

loadAiEnv();

const connectionString = process.env.MASTRA_STORAGE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('MASTRA_STORAGE_URL or DATABASE_URL is required.');
}

const openAICompatibleGateway = createOpenAICompatibleGatewayFromEnv(process.env);

export const mastra = new Mastra({
  agents: {
    linkAdjudicatorAgent,
    ingestionAgent,
    refinementAgent,
  },
  gateways: openAICompatibleGateway ? { [openAICompatibleGateway.id]: openAICompatibleGateway } : {},
  storage: createMastraStorage(connectionString),
  workflows: {
    sourceLinkingWorkflow,
  },
});
