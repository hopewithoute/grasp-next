import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { containsGraphMutationToolCall } from './refinement-chat-mutation-detection';

describe('refinement chat mutation detection', () => {
  it('treats graph proposals as mutation-intent events', () => {
    assert.equal(
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
      }),
      true
    );
  });

  it('keeps read-only refinement tools out of mutation detection', () => {
    assert.equal(
      containsGraphMutationToolCall({
        toolCalls: [
          {
            toolName: 'search-wiki-concepts',
          },
          {
            toolName: 'read-webpage',
          },
        ],
      }),
      false
    );
  });

  it('does not match removed legacy mutation tool names', () => {
    assert.equal(
      containsGraphMutationToolCall({
        toolCalls: [
          {
            toolName: 'add-evidence',
          },
        ],
      }),
      false
    );
  });
});
