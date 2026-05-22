import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIngestionPrompt } from './ingestion-prompt';

describe('buildIngestionPrompt', () => {
  it('keeps DB-wide existing concepts out of the prompt and directs retrieval tool use', () => {
    const prompt = buildIngestionPrompt({
      blocks: [{ id: 'block-0001', text: 'Inflasi adalah kenaikan harga umum.' }],
      chunkIndex: 0,
      draftConcepts: [],
      sourceId: 'source-1',
      totalChunks: 1,
    });

    assert.match(prompt, /search-wiki-concepts/);
    assert.match(prompt, /get-concept-context/);
    assert.doesNotMatch(prompt, /search-source-passages/);
    assert.doesNotMatch(prompt, /<thinking>/);
    assert.doesNotMatch(prompt, /<\/thinking>/);
    assert.doesNotMatch(prompt, /Existing Concepts/);
    assert.doesNotMatch(prompt, /already in knowledgebase/);
  });
});
