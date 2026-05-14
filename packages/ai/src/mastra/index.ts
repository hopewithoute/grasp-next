import { Mastra } from "@mastra/core";
import { conceptExtractorAgent } from "./agents/concept-extractor-agent";

export const mastra = new Mastra({
  agents: {
    conceptExtractorAgent,
  },
});
