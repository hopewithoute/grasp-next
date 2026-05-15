import { Mastra } from '@mastra/core';
import { conceptExtractorAgent } from './agents/concept-extractor-agent';
import { extractConceptsWorkflow } from './workflows/extract-concepts-workflow';
import { createMastraStorage } from './storage';

const connectionString = process.env.MASTRA_STORAGE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('MASTRA_STORAGE_URL or DATABASE_URL is required.');
}

export const mastra = new Mastra({
  agents: {
    conceptExtractorAgent,
  },
  storage: createMastraStorage(connectionString),
  workflows: {
    extractConceptsWorkflow,
  },
});
