import 'server-only';

import {
  createArtifactRepository,
  createAuditLogRepository,
  createDbClient,
  createIngestionRunRepository,
  createKnowledgebaseRepository,
  createProjectSourceRepository,
  createProjectRepository,
} from '@grasp/db';
import { serverEnv } from './env';

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
    auditLogRepository: createAuditLogRepository(db),
    ingestionRunRepository: createIngestionRunRepository(db),
    knowledgebaseRepository: createKnowledgebaseRepository(db),
    projectRepository: createProjectRepository(db),
    projectSourceRepository: createProjectSourceRepository(db),
  };
}

type ProjectDeps = ReturnType<typeof buildProjectDeps>;

const globalForProjectDeps = globalThis as typeof globalThis & {
  graspProjectDeps?: ProjectDeps;
};
