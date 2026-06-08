/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import type { KnowledgebaseRepository } from '@grasp/domain';
import { createRefinementTools } from './refinement-tools';

// A mock repository since we're only testing the web tools
const mockKnowledgebaseRepository = {} as unknown as KnowledgebaseRepository;

describe('Refinement Tools (Integration)', () => {
  const tools = createRefinementTools({
    knowledgebaseRepository: mockKnowledgebaseRepository,
    projectId: 'test-project-id',
  });

  it('searchWebTool can search DuckDuckGo and return results', async () => {
    // This performs a REAL network request to DuckDuckGo
    try {
      const result = (await (tools.searchWebTool as any).execute(
        { query: 'React web framework' },
        {} as any
      ));

      expect(result.results).toBeTruthy();
      expect(Array.isArray(result.results)).toBeTruthy();
      expect(result.results.length > 0).toBeTruthy();

      const firstResult = result.results[0];
      expect(firstResult.title).toBeTruthy();
      expect(firstResult.description).toBeTruthy();
      expect(firstResult.url).toBeTruthy();
      expect(firstResult.url).toMatch(/^https?:\/\//);
    } catch (e: any) {
      if (e.message && e.message.includes('anomaly')) {
        console.warn('Skipping DDG search test due to rate limiting: ', e.message);
        return;
      }
      throw e;
    }
  });
});
