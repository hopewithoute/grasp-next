import "server-only";

import {
  createArtifactRepository,
  createArtifactReviewRunRepository,
  createAuditLogRepository,
  createConceptRepository,
  createDbClient,
  createProjectRepository,
} from "@grasp/db";
import { resumeArtifactReview } from "@grasp/ai";
import { createConceptExtractionQueue } from "./queue";

export function createProjectDeps() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const db = createDbClient(databaseUrl);

  return {
    artifactRepository: createArtifactRepository(db),
    artifactReviewRunRepository: createArtifactReviewRunRepository(db),
    auditLogRepository: createAuditLogRepository(db),
    conceptRepository: createConceptRepository(db),
    conceptExtractionQueue: createConceptExtractionQueue(),
    projectRepository: createProjectRepository(db),
    reviewWorkflow: {
      resumeReview: resumeArtifactReview,
    },
  };
}
