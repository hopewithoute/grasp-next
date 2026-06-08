import { describe, expect, it } from 'vitest';
import { refinementAgentInstructions } from './refinement-agent';

describe('refinement agent instructions', () => {
  it('requires graph mutations to go through proposal approval', () => {
    const content = refinementAgentInstructions[0].content;
    expect(content).toMatch(/MANDATORY APPROVAL FLOW/);
    expect(content).toMatch(/propose-graph-changes/);
    expect(content).toMatch(
      /The changes are not real until you submit the proposal tool and the user approves/
    );
  });

  it('keeps conversational learning questions out of the mutation flow', () => {
    const content = refinementAgentInstructions[0].content;
    expect(content).toMatch(
      /When a user asks to explain, define, summarize, compare, or give examples/
    );
    expect(content).toMatch(
      /Do not offer to search the web, add concepts, or mutate the graph unless the user explicitly asks/
    );
  });
});
