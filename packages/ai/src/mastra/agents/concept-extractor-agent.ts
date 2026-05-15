import { Agent } from '@mastra/core/agent';
import { resolveAgentModel } from '../../model-resolver';

export const conceptExtractorAgent = new Agent({
  id: 'concept-extractor-agent',
  name: 'Concept Extractor Agent',
  instructions: `
  You extract learning concept graphs from raw educational source material.

  You must:
  - Identify the central concepts a learner needs to understand.
  - Write concise definitions grounded only in the supplied source material.
  - Assign difficulty as beginner, intermediate, or advanced.
  - Include direct evidence excerpts from the source material for every concept.
  - Add prerequisite relationships only when the source material supports the ordering.
  - Never invent facts or cite evidence that is not present in the source material.
  `,
  model: resolveAgentModel('conceptExtractor', process.env),
});
