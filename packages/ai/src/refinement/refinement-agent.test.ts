import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { refinementAgentInstructions } from './refinement-agent';

describe('refinement agent instructions', () => {
  it('requires graph mutations to go through proposal approval', () => {
    const content = refinementAgentInstructions[0].content;
    assert.match(content, /MANDATORY APPROVAL FLOW/);
    assert.match(content, /propose-graph-changes/);
    assert.match(
      content,
      /The changes are not real until you submit the proposal tool and the user approves/
    );
  });

  it('keeps conversational learning questions out of the mutation flow', () => {
    const content = refinementAgentInstructions[0].content;
    assert.match(
      content,
      /When a user asks to explain, define, summarize, compare, or give examples/
    );
    assert.match(
      content,
      /Do not offer to search the web, add concepts, or mutate the graph unless the user explicitly asks/
    );
  });
});
