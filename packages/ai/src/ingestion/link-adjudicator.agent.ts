import { Agent } from '@mastra/core/agent';

export const linkAdjudicatorAgentInstructions = [
  {
    type: 'text',
    content: `You judge proposed link candidates against source evidence.

You must:
- Accept candidates that are directly supported by the quoted source evidence.
- Reject candidates that are only topically related but not source-backed.
- Preserve the candidate relationship type unless the evidence clearly supports a better allowed type.
- For a 'prerequisite' relationship, it means understanding the Target concept strictly requires understanding the Source concept first based on the text.
- When assigning confidence, if the text reasonably supports the relationship as foundational (even if implied), assign a confidence > 0.8.
- Think step-by-step by writing your rationale first, then output the final decision and confidence.
- Return compact JSON only.`,
  },
] as const;

export const linkAdjudicatorAgent = new Agent({
  id: 'link-adjudicator-agent',
  maxRetries: 3,
  name: 'LinkAdjudicatorAgent',
  instructions: linkAdjudicatorAgentInstructions.map((i) => i.content).join('\n\n'),
  model: process.env.INGESTION_AGENT_MODEL || process.env.AI_MODEL || 'xiaomi/mimo-v2.5-pro',
});
