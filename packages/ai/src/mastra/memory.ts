import type { MemoryConfig } from '@mastra/core/memory';
import { Memory } from '@mastra/memory';
import { createMastraStorage } from './storage';

export function createGraspMemory(options: MemoryConfig) {
  const connectionString = process.env.MASTRA_STORAGE_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      '[createGraspMemory] MASTRA_STORAGE_URL or DATABASE_URL must be set. Memory requires a storage provider.'
    );
  }

  return new Memory({
    options,
    storage: createMastraStorage(connectionString),
  });
}
