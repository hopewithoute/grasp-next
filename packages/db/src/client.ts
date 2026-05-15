import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDbClient(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    connection: {
      application_name: "grasp-app",
    },
    idle_timeout: 20,
    max: 2,
  });

  return drizzle(client, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
