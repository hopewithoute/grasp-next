import { Mastra } from '@mastra/core';
import { createMastraStorage } from './storage';
import { ingestionAgent } from '../ingestion/ingestion-agent';

const connectionString = process.env.MASTRA_STORAGE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('MASTRA_STORAGE_URL or DATABASE_URL is required.');
}

export const mastra = new Mastra({
  agents: {
    ingestionAgent,
  },
  storage: createMastraStorage(connectionString),
});
