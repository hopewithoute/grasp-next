import { PostgresStore } from "@mastra/pg";

export function createMastraStorage() {
  const connectionString =
    process.env.MASTRA_STORAGE_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("MASTRA_STORAGE_URL or DATABASE_URL is required.");
  }

  return new PostgresStore({
    connectionString,
    idleTimeoutMillis: 20_000,
    id: "grasp-mastra-storage",
    max: 2,
  });
}
