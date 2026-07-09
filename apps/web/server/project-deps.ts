import 'server-only';
import {
  createArtifactRepository,
  createAuditLogRepository,
  createDbClient,
  createIngestionRunRepository,
  createProjectRepository,
} from '@grasp/db';
import { serverEnv } from './env';
import { createEvidenceKbService } from './evidence-kb';

import { createEvidenceKbProjectSourceRepository } from './project-source-repository-adapter';

export function createProjectDeps() {
  if (globalForProjectDeps.graspProjectDepsV2) {
    return globalForProjectDeps.graspProjectDepsV2;
  }

  globalForProjectDeps.graspProjectDepsV2 = buildProjectDeps();

  return globalForProjectDeps.graspProjectDepsV2;
}

function buildProjectDeps() {
  const db = createDbClient(serverEnv.DATABASE_URL);

  const projectRepository = createProjectRepository(db);

  const evidenceKbService = createEvidenceKbService({
    apiKey: serverEnv.EVIDENCE_KB_API_KEY,
    baseUrl: serverEnv.EVIDENCE_KB_BASE_URL,
    projectRepository,
  });

  return {
    artifactRepository: createArtifactRepository(db),
    auditLogRepository: createAuditLogRepository(db),
    evidenceKbService,
    ingestionRunRepository: createIngestionRunRepository(db),
    projectRepository,
    projectSourceRepository: createEvidenceKbProjectSourceRepository(evidenceKbService),
  };
}

type ProjectDeps = ReturnType<typeof buildProjectDeps>;

const globalForProjectDeps = globalThis as typeof globalThis & {
  graspProjectDepsV2?: ProjectDeps;
};
