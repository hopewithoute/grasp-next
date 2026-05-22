import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readMastraTextDelta } from './refinement-chat-stream';

describe('refinement chat stream adapter', () => {
  it('extracts text from Mastra fullStream text chunks', () => {
    assert.equal(
      readMastraTextDelta({ type: 'text-delta', payload: { text: 'Refined graph.' } }),
      'Refined graph.'
    );
  });

  it('ignores tool chunks instead of treating them as fatal text output', () => {
    assert.equal(
      readMastraTextDelta({ type: 'tool-call', payload: { toolName: 'add-evidence' } }),
      null
    );
  });

  it('keeps compatibility with plain textStream chunks', () => {
    assert.equal(
      readMastraTextDelta({ type: 'text-delta', textDelta: 'Done.' }),
      'Done.'
    );
  });
});
