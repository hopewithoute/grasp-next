import { describe, expect, it } from 'vitest';
import { buildIngestionPrompt, ingestionAgentInstructions } from './ingestion-agent';

describe('buildIngestionPrompt', () => {
  it('keeps DB-wide existing concepts out of the prompt and directs retrieval tool use', () => {
    const prompt = buildIngestionPrompt({
      blocks: [{ id: 'block-0001', text: 'Inflasi adalah kenaikan harga umum.' }],
      chunkIndex: 0,
      draftConcepts: [],
      sourceId: 'source-1',
      totalChunks: 1,
    });

    const instructions = ingestionAgentInstructions[0].content;

    expect(instructions).toMatch(/search-wiki-concepts/);
    expect(instructions).toMatch(/get-concept-context/);
    expect(prompt).not.toMatch(/search-source-passages/);
    expect(prompt).not.toMatch(/<thinking>/);
    expect(prompt).not.toMatch(/<\/thinking>/);
    expect(prompt).not.toMatch(/Existing Concepts/);
    expect(prompt).not.toMatch(/already in knowledgebase/);
  });
});
