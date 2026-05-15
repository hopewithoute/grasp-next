import { PostgresStore } from '@mastra/pg';

export function createMastraStorage(connectionString: string) {
  return new PostgresStore({
    connectionString,
    idleTimeoutMillis: 20_000,
    id: 'grasp-mastra-storage',
    max: 2,
  });
}
