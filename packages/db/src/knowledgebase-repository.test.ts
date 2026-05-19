import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { knowledgebaseArtifactContentDto } from '@grasp/domain';
import { createKnowledgebaseRepository } from './knowledgebase-repository';
import { createProjectRepository } from './project-repository';
import { createProjectSourceRepository } from './project-source-repository';
import * as schema from './schema';
import {
  knowledgebaseVersions,
  knowledgebases,
  projects,
  sourcePassages,
  user,
  wikiConcepts,
} from './schema';

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase('createKnowledgebaseRepository', () => {
  if (!databaseUrl) {
    return;
  }

  const sql = postgres(databaseUrl);
  const db = drizzle(sql, { schema });
  const knowledgebaseRepository = createKnowledgebaseRepository(db);
  const projectRepository = createProjectRepository(db);
  const projectSourceRepository = createProjectSourceRepository(db);
  const ownerId = `knowledgebase-repository-test-${randomUUID()}`;

  before(async () => {
    await db.insert(user).values({
      createdAt: new Date(),
      email: `${ownerId}@example.test`,
      emailVerified: true,
      id: ownerId,
      name: 'Knowledgebase Repository Test',
      updatedAt: new Date(),
    });
  });

  after(async () => {
    await db.delete(user).where(eq(user.id, ownerId));
    await sql.end();
  });

  it('persists source passages and relational wiki rows from an artifact snapshot', async () => {
    const project = await projectRepository.create({
      description: 'Repository integration test',
      ownerId,
      title: 'Knowledgebase repository test',
    });

    try {
      const source = await projectSourceRepository.createForProjectOwner(project.id, ownerId, {
        content: 'Markets coordinate supply and demand.',
        title: 'Market source',
        type: 'text',
      });
      assert.ok(source);

      const content = knowledgebaseArtifactContent(source.id);

      const version = await knowledgebaseRepository.replaceVersionFromContent({
        content,
        projectId: project.id,
      });

      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, project.id));
      const [storedVersion] = await db
        .select()
        .from(knowledgebaseVersions)
        .where(eq(knowledgebaseVersions.id, version.id));
      const passages = await db
        .select()
        .from(sourcePassages)
        .where(eq(sourcePassages.projectId, project.id));
      const concepts = await db
        .select()
        .from(wikiConcepts)
        .where(eq(wikiConcepts.knowledgebaseVersionId, version.id));

      assert.equal(knowledgebase?.currentVersionId, version.id);
      assert.equal(storedVersion?.knowledgebaseId, knowledgebase?.id);
      assert.equal(passages.length, 1);
      assert.equal(passages[0]?.blockId, `${source.id}:block-0001`);
      assert.equal(concepts.length, 1);
      assert.equal(concepts[0]?.conceptKey, 'market');

      const graph = await knowledgebaseRepository.findCurrentGraphByProject(project.id);

      assert.equal(graph?.concepts.length, 1);
      assert.equal(graph?.concepts[0]?.id, 'market');
      const evidence = graph?.concepts[0]?.sourceEvidence as Array<{ blockId: string }> | undefined;
      assert.equal(evidence?.[0]?.blockId, `${source.id}:block-0001`);
      assert.equal(graph?.relationships.length, 0);

      const searchResults = await knowledgebaseRepository.searchConceptsForIngestion({
        projectId: project.id,
        query: 'market',
      });

      assert.equal(searchResults.length, 1);
      assert.equal(searchResults[0]?.conceptKey, 'market');
      assert.equal(searchResults[0]?.evidenceCount, 1);

      const context = await knowledgebaseRepository.getConceptContext({
        conceptKey: 'market',
        projectId: project.id,
      });

      assert.equal(context?.concept.conceptKey, 'market');
      assert.equal(context?.concept.evidenceCount, 1);
      assert.equal(context?.evidence[0]?.blockId, `${source.id}:block-0001`);
      assert.equal(context?.neighbors.length, 0);
    } finally {
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  });
});

function knowledgebaseArtifactContent(sourceId: string) {
  const blockId = `${sourceId}:block-0001`;
  const sourceRef = {
    blockId,
    locationLabel: 'Market source / Block 1',
    quote: 'Markets coordinate supply and demand.',
    sourceId,
  };

  return knowledgebaseArtifactContentDto.parse({
    graphProjection: {
      edges: [],
      nodes: [
        {
          conceptId: 'market',
          id: 'node:market',
          label: 'Market',
        },
      ],
    },
    knowledgebase: {
      concepts: [
        {
          confidence: 0.91,
          definition: 'A place where buyers and sellers coordinate exchange.',
          difficulty: 'beginner',
          id: 'market',
          name: 'Market',
          sourceRefs: [sourceRef],
        },
      ],
      overview: 'Markets coordinate supply and demand.',
      relationships: [],
    },
    normalizedSource: normalizedSource(sourceId),
  });
}

function normalizedSource(sourceId: string) {
  return {
    blocks: [
      {
        id: `${sourceId}:block-0001`,
        kind: 'paragraph',
        location: { label: 'Market source / Block 1' },
        order: 0,
        sourceId,
        text: 'Markets coordinate supply and demand.',
      },
    ],
    id: 'project-1:source-set:current',
    sourceType: 'text',
    title: 'Project sources',
  };
}
