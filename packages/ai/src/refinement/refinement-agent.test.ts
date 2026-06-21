import { describe, expect, it, vi } from 'vitest';
import { refinementAgentInstructions } from './refinement-agent';

vi.mock('../mastra/memory', () => ({
  createGraspMemory: vi.fn(),
}));

describe('refinement agent instructions', () => {
  it('requires curation mutations to go through proposal approval', () => {
    const content = refinementAgentInstructions[0].content;
    expect(content).toMatch(/MANDATORY APPROVAL FLOW/);
    expect(content).toMatch(/propose-evidence-curation/);
    expect(content).toMatch(/You are an assistant who drafts proposals, not a direct executor/);
  });

  it('keeps conversational learning questions out of the mutation flow', () => {
    const content = refinementAgentInstructions[0].content;
    expect(content).toMatch(
      /When a user asks to explain, define, summarize, compare, or give examples/
    );
    expect(content).toMatch(/Do not offer to curate evidence unless the user explicitly asks/);
  });
});
