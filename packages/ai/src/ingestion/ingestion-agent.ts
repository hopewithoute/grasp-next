import { Agent } from '@mastra/core/agent';
import { resolveAgentModel } from '../model-resolver';

export const ingestionAgent = new Agent({
  id: 'ingestion-agent',
  name: 'Source Ingestion Agent',
  instructions: `
You extract knowledge concepts and typed relationships from source material chunks.

You must:
- Identify teachable concepts grounded only in the supplied text.
- Assign stable conceptKey slugs (lowercase, hyphenated).
- Reuse existing conceptKeys when the chunk adds to an already-known concept.
- Use the retrieval tools before creating a new concept when a candidate may overlap with existing knowledgebase content.
- Use concept context from tools to update existing concepts with synthesis across old and new evidence.
- Use mergesWith when a concept is the same as an existing one but named differently.
- Write concise definitions grounded in the source text.
- Include exact quote evidence from the chunk for every concept.
- Add typed relationships only when the text supports the relation.
- Never invent facts or cite evidence not present in the chunk.
`,
  model: resolveAgentModel('ingestionAgent', process.env),
});
