import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { conceptExtractorAgent } from "./agents/concept-extractor-agent";
import { extractConceptsWorkflow } from "./workflows/extract-concepts-workflow";

export const mastra = new Mastra({
  agents: {
    conceptExtractorAgent,
  },
  storage: createMastraStorage(),
  workflows: {
    extractConceptsWorkflow,
  },
});

function createMastraStorage() {
  const connectionString =
    process.env.MASTRA_STORAGE_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("MASTRA_STORAGE_URL or DATABASE_URL is required.");
  }

  return new PostgresStore({
    connectionString,
    id: "grasp-mastra-storage",
  });
}
