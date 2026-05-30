import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { createArtifactRepository } from './artifact-repository';
import { createProjectRepository } from './project-repository';
import * as schema from './schema';
import { projects, user } from './schema';

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase('createArtifactRepository', () => {
  if (!databaseUrl) {
    return;
  }

  const sql = postgres(databaseUrl);
  const db = drizzle(sql, { schema });
  const artifactRepository = createArtifactRepository(db);
  const projectRepository = createProjectRepository(db);
  const ownerId = `artifact-repository-test-${randomUUID()}`;

  beforeAll(async () => {
    await db.insert(user).values({
      createdAt: new Date(),
      email: `${ownerId}@example.test`,
      emailVerified: true,
      id: ownerId,
      name: 'Artifact Repository Test',
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, ownerId));
    await sql.end();
  });

  it('creates sequential artifact versions and stores revision feedback on the latest version', async () => {
    const project = await projectRepository.create({
      description: 'Repository integration test',
      ownerId,
      title: 'Artifact repository test',
    });

    try {
      const artifact = await artifactRepository.create({
        projectId: project.id,
        status: 'generating',
        type: 'concept_graph',
      });
      const versionOne = await artifactRepository.createVersion({
        artifactId: artifact.id,
        content: {
          concepts: ['Atom'],
        },
        extractionMode: 'llm_strict',
        revisionFeedback: null,
      });
      const versionTwo = await artifactRepository.createVersion({
        artifactId: artifact.id,
        content: {
          concepts: ['Atom', 'Molecule'],
        },
        extractionMode: 'llm_json',
        revisionFeedback: 'Split atom and molecule concepts.',
      });
      const versions = await artifactRepository.listVersions(artifact.id);
      const updatedArtifact = await artifactRepository.findById(artifact.id);

      expect(versionOne.versionNumber).toBe(1);
      expect(versionOne.revisionFeedback).toBe(null);
      expect(versionOne.extractionMode).toBe('llm_strict');
      expect(versionTwo.versionNumber).toBe(2);
      expect(versionTwo.revisionFeedback).toBe('Split atom and molecule concepts.');
      expect(versionTwo.extractionMode).toBe('llm_json');
      expect(versions.length).toBe(2);
      expect(versions[0]?.id).toBe(versionTwo.id);
      expect(versions[1]?.id).toBe(versionOne.id);
      expect(updatedArtifact?.currentVersionId).toBe(versionTwo.id);
    } finally {
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  });
});
