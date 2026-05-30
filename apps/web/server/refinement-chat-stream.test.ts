import { describe, expect, it } from 'vitest';
import { readMastraTextDelta } from './refinement-chat-stream';

describe('refinement chat stream adapter', () => {
  it('extracts text from Mastra fullStream text chunks', () => {
    expect(
      readMastraTextDelta({ type: 'text-delta', payload: { text: 'Refined graph.' } })
    ).toBe('Refined graph.');
  });

  it('ignores tool chunks instead of treating them as fatal text output', () => {
    expect(
      readMastraTextDelta({ type: 'tool-call', payload: { toolName: 'add-evidence' } })
    ).toBe(null);
  });

  it('keeps compatibility with plain textStream chunks', () => {
    expect(readMastraTextDelta({ type: 'text-delta', textDelta: 'Done.' })).toBe('Done.');
  });
});
