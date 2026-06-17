import 'server-only';
import {
  createArtifactRepository,
  createAuditLogRepository,
  createDbClient,
  createIngestionRunRepository,
  createProjectRepository,
  createProjectSourceRepository,
} from '@grasp/db';
import { serverEnv } from './env';
import { createLgsService } from './lgs-service';

export function createProjectDeps() {
  if (globalForProjectDeps.graspProjectDeps) {
    return globalForProjectDeps.graspProjectDeps;
  }

  globalForProjectDeps.graspProjectDeps = buildProjectDeps();

  return globalForProjectDeps.graspProjectDeps;
}

function buildProjectDeps() {
  const db = createDbClient(serverEnv.DATABASE_URL);

  const projectRepository = createProjectRepository(db);

  return {
    artifactRepository: createArtifactRepository(db),
    auditLogRepository: createAuditLogRepository(db),
    ingestionRunRepository: createIngestionRunRepository(db),
    lgsService: createLgsService({
      apiKey: serverEnv.LGS_API_KEY,
      baseUrl: serverEnv.LGS_BASE_URL,
      projectRepository,
    }),
    projectRepository,
    projectSourceRepository: createProjectSourceRepository(db),
  };
}

type ProjectDeps = ReturnType<typeof buildProjectDeps>;

const globalForProjectDeps = globalThis as typeof globalThis & {
  graspProjectDeps?: ProjectDeps;
};
