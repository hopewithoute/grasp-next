import { describe, expect, it } from 'vitest';
import { containsGraphMutationToolCall } from './refinement-chat-mutation-detection';

describe('refinement chat mutation detection', () => {
  it('treats graph proposals as mutation-intent events', () => {
    expect(
      containsGraphMutationToolCall({
        steps: [
          {
            toolCalls: [
              {
                toolName: 'propose-graph-changes',
              },
            ],
          },
        ],
      })
    ).toBe(true);
  });

  it('keeps read-only refinement tools out of mutation detection', () => {
    expect(
      containsGraphMutationToolCall({
        toolCalls: [
          {
            toolName: 'search-wiki-concepts',
          },
        ],
      })
    ).toBe(false);
  });

  it('does not match removed legacy mutation tool names', () => {
    expect(
      containsGraphMutationToolCall({
        toolCalls: [
          {
            toolName: 'add-evidence',
          },
        ],
      })
    ).toBe(false);
  });
});
