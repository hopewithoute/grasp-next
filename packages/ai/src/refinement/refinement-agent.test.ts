import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { refinementAgentInstructions } from './refinement-agent';

describe('refinement agent instructions', () => {
  it('requires graph mutations to go through proposal approval', () => {
    assert.match(refinementAgentInstructions, /MANDATORY APPROVAL FLOW/);
    assert.match(refinementAgentInstructions, /propose-graph-changes/);
    assert.match(refinementAgentInstructions, /The changes are not real until you submit the proposal tool and the user approves/);
  });

  it('keeps conversational learning questions out of the mutation flow', () => {
    assert.match(refinementAgentInstructions, /When a user asks to explain, define, summarize, compare, or give examples/);
    assert.match(refinementAgentInstructions, /Do not offer to search the web, add concepts, or mutate the graph unless the user explicitly asks/);
  });
});
