import { Mastra } from "@mastra/core";
import { conceptExtractorAgent } from "./agents/concept-extractor-agent";
import { extractConceptsWorkflow } from "./workflows/extract-concepts-workflow";
import { createMastraStorage } from "./storage";

export const mastra = new Mastra({
  agents: {
    conceptExtractorAgent,
  },
  storage: createMastraStorage(),
  workflows: {
    extractConceptsWorkflow,
  },
});
