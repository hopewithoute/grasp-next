import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from './env';
import { createIngestionRunRepository } from './ingestion-run-repository';
import { createProjectRepository } from './project-repository';
import * as schema from './schema';
import { projects, user } from './schema';

const databaseUrl = env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase('createIngestionRunRepository', () => {
  if (!databaseUrl) {
    return;
  }

  const sql = postgres(databaseUrl);
  const db = drizzle(sql, { schema });
  const ingestionRunRepository = createIngestionRunRepository(db);
  const projectRepository = createProjectRepository(db);
  const ownerId = `ingestion-run-repository-test-${randomUUID()}`;

  beforeAll(async () => {
    await db.insert(user).values({
      createdAt: new Date(),
      email: `${ownerId}@example.test`,
      emailVerified: true,
      id: ownerId,
      name: 'Ingestion Run Repository Test',
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, ownerId));
    await sql.end();
  });

  it('tracks latest ingestion run status transitions for a project', async () => {
    const project = await projectRepository.create({
      description: 'Repository integration test',
      ownerId,
      title: 'Ingestion run repository test',
    });

    try {
      const run = await ingestionRunRepository.create({
        metadata: { reason: 'source_updated' },
        projectId: project.id,
      });

      expect(run.status).toBe('ingesting');
      expect(run.completedAt).toBe(null);

      const completed = await ingestionRunRepository.markCompleted(run.id, {
        conceptCount: 1,
      });
      const latest = await ingestionRunRepository.findLatestByProject(project.id);

      expect(completed?.status).toBe('completed');
      expect(completed?.completedAt).toBeTruthy();
      expect(latest?.id).toBe(run.id);
      expect(latest?.status).toBe('completed');
    } finally {
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  });
});
