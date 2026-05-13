import "server-only";

import {
  createAuditLogRepository,
  createDbClient,
  createProjectRepository,
} from "@grasp/db";
import { createConceptExtractionQueue } from "./queue";

export function createProjectDeps() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const db = createDbClient(databaseUrl);

  return {
    auditLogRepository: createAuditLogRepository(db),
    conceptExtractionQueue: createConceptExtractionQueue(),
    projectRepository: createProjectRepository(db),
  };
}
