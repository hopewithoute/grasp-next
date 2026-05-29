/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRefinementTools } from './refinement-tools';
import type { KnowledgebaseRepository } from '@grasp/domain';

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
      )) as any;

      assert.ok(result.results, 'Expected results array to exist');
      assert.ok(Array.isArray(result.results), 'Results should be an array');
      assert.ok(result.results.length > 0, 'Should find at least one result');

      const firstResult = result.results[0];
      assert.ok(firstResult.title, 'Result should have title');
      assert.ok(firstResult.description, 'Result should have description');
      assert.ok(firstResult.url, 'Result should have url');
      assert.match(firstResult.url, /^https?:\/\//, 'URL should be absolute');
    } catch (e: any) {
      if (e.message && e.message.includes('anomaly')) {
        console.warn('Skipping DDG search test due to rate limiting: ', e.message);
        return;
      }
      throw e;
    }
  });

  it('readWebpageTool can fetch and extract text from a real URL', async () => {
    const tools = createRefinementTools({
      projectId: 'test-project',
      knowledgebaseRepository: {} as any,
    });

    const result = (await (tools.readWebpageTool as any).execute(
      { url: 'https://example.com' },
      {} as any
    )) as any;

    assert.ok(result.text, 'Expected extracted text to exist');
    assert.ok(typeof result.text === 'string', 'Text should be a string');
    assert.match(result.text, /Example Domain/i, 'Text should contain Example Domain');
    assert.match(
      result.text,
      /documentation examples/i,
      'Text should contain the updated example sentence'
    );
  });
});
