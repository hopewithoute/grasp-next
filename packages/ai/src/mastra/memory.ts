import type { MemoryConfig } from '@mastra/core/memory';
import { Memory } from '@mastra/memory';
import { getMastraStorage } from './storage';

export function createGraspMemory(options?: MemoryConfig) {
  return new Memory({
    options,
    storage: getMastraStorage(),
  });
}
