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
import { createEvidenceKbService } from './evidence-kb-service';
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
    evidenceKbService: createEvidenceKbService({
      apiKey: serverEnv.EVIDENCE_KB_API_KEY,
      baseUrl: serverEnv.EVIDENCE_KB_BASE_URL,
      projectRepository,
    }),
    ingestionRunRepository: createIngestionRunRepository(db),
    projectRepository,
    projectSourceRepository: createProjectSourceRepository(db),
  };
}

type ProjectDeps = ReturnType<typeof buildProjectDeps>;

const globalForProjectDeps = globalThis as typeof globalThis & {
  graspProjectDeps?: ProjectDeps;
};
