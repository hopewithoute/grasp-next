import { PostgresStore } from '@mastra/pg';
import { loadAiEnv } from '../load-env';

let store: PostgresStore | null = null;

export function getMastraStorage() {
  if (store) return store;

  loadAiEnv();
  const connectionString = process.env.MASTRA_STORAGE_URL;

  if (!connectionString) {
    throw new Error(
      '[getMastraStorage] MASTRA_STORAGE_URL must be set. Mastra storage uses a dedicated database connection.'
    );
  }

  store = new PostgresStore({
    connectionString,
    idleTimeoutMillis: 20_000,
    id: 'grasp-mastra-storage',
    max: 5,
  });

  return store;
}
