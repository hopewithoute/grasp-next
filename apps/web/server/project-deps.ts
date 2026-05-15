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
import { serverEnv } from "./env";

export function createProjectDeps() {
  if (globalForProjectDeps.graspProjectDeps) {
    return globalForProjectDeps.graspProjectDeps;
  }

  globalForProjectDeps.graspProjectDeps = buildProjectDeps();

  return globalForProjectDeps.graspProjectDeps;
}

function buildProjectDeps() {
  const db = createDbClient(serverEnv.DATABASE_URL);

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

type ProjectDeps = ReturnType<typeof buildProjectDeps>;

const globalForProjectDeps = globalThis as typeof globalThis & {
  graspProjectDeps?: ProjectDeps;
};
