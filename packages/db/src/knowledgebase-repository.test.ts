import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';
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
  wikiRelationships,
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

      await db
        .update(wikiConcepts)
        .set({ embedding: embeddingVector(0.9, 0.1) })
        .where(eq(wikiConcepts.conceptKey, 'market'));

      const semanticConcepts = await knowledgebaseRepository.searchConceptsForIngestion({
        embedding: embeddingVector(0.9, 0.1),
        projectId: project.id,
        query: 'exchange venue',
      });

      assert.equal(semanticConcepts[0]?.conceptKey, 'market');
      assert.equal(typeof semanticConcepts[0]?.distance, 'number');

      await knowledgebaseRepository.upsertSourcePassages({
        blocks: [
          {
            id: 'evidence-only',
            kind: 'paragraph',
            location: { label: 'Evidence only' },
            order: 1,
            sourceId: source.id,
            text: 'Inflation is a sustained rise in the general price level.',
          },
        ],
        projectId: project.id,
        sourceId: source.id,
      });

      const [evidenceOnlyPassage] = await db
        .select({ embedding: sourcePassages.embedding })
        .from(sourcePassages)
        .where(eq(sourcePassages.blockId, `${source.id}:evidence-only`));

      assert.equal(evidenceOnlyPassage?.embedding, null);
    } finally {
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  });

  it('persists relationship evidence quality metadata from ingestion output', async () => {
    const project = await projectRepository.create({
      description: 'Relationship metadata test',
      ownerId,
      title: 'Relationship metadata',
    });

    try {
      const source = await projectSourceRepository.createForProjectOwner(project.id, ownerId, {
        content: 'Elasticity builds on supply and demand.',
        title: 'Elasticity source',
        type: 'text',
      });
      assert.ok(source);

      await knowledgebaseRepository.upsertSourcePassages({
        blocks: [
          {
            id: 'block-0001',
            kind: 'paragraph',
            location: { label: 'Elasticity source / Block 1' },
            order: 0,
            sourceId: source.id,
            text: 'Elasticity builds on supply and demand.',
          },
        ],
        projectId: project.id,
        sourceId: source.id,
      });

      await knowledgebaseRepository.mergeIngestionOutput({
        output: {
          concepts: [
            {
              conceptKey: 'supply-and-demand',
              confidence: 0.9,
              definition: 'Supply and demand describes market coordination.',
              difficulty: 'beginner',
              mergesWith: undefined,
              name: 'Supply and Demand',
              sourceRefs: [
                {
                  blockId: 'block-0001',
                  locationLabel: 'Elasticity source / Block 1',
                  quote: 'Elasticity builds on supply and demand.',
                },
              ],
            },
            {
              conceptKey: 'elasticity',
              confidence: 0.9,
              definition: 'Elasticity measures responsiveness.',
              difficulty: 'intermediate',
              mergesWith: undefined,
              name: 'Elasticity',
              sourceRefs: [
                {
                  blockId: 'block-0001',
                  locationLabel: 'Elasticity source / Block 1',
                  quote: 'Elasticity builds on supply and demand.',
                },
              ],
            },
          ],
          relationClaims: [],
          relationships: [
            {
              evidenceQuality: {
                evidenceKind: 'sentence',
                evidenceReason: 'sentence+prerequisite_language',
                evidenceStrength: 'strong',
                finalEvidenceScore: 0.88,
                grounded: true,
                groundingReason: 'exact_quote',
                relationshipTypeConfidence: 0.9,
                semanticSupportConfidence: 0.88,
                shapeScore: 0.85,
              },
              relationshipType: 'prerequisite',
              sourceConceptKey: 'supply-and-demand',
              sourceRefs: [
                {
                  blockId: 'block-0001',
                  locationLabel: 'Elasticity source / Block 1',
                  quote: 'Elasticity builds on supply and demand.',
                },
              ],
              targetConceptKey: 'elasticity',
            },
          ],
        },
        projectId: project.id,
        sourceId: source.id,
      });

      const graph = await knowledgebaseRepository.findCurrentGraphByProject(project.id);
      const relationship = graph?.relationships[0];
      const metadata = relationship?.metadata as
        | { evidenceQuality?: { finalEvidenceScore?: number } }
        | undefined;

      assert.equal(relationship?.relationshipType, 'prerequisite');
      assert.equal(metadata?.evidenceQuality?.finalEvidenceScore, 0.88);

      const [storedRelationship] = await db
        .select({ metadata: wikiRelationships.metadata })
        .from(wikiRelationships)
        .innerJoin(knowledgebases, eq(wikiRelationships.knowledgebaseId, knowledgebases.id))
        .where(
          and(
            eq(knowledgebases.projectId, project.id),
            eq(wikiRelationships.relationshipKey, 'supply-and-demand:elasticity:prerequisite')
          )
        );

      assert.deepEqual(storedRelationship?.metadata, relationship?.metadata);
    } finally {
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  });

  it('searchConceptsWithPagination returns paginated results', async () => {
    const project = await projectRepository.create({
      description: 'Pagination test project',
      ownerId,
      title: 'Pagination metadata',
    });

    try {
      const source = await projectSourceRepository.createForProjectOwner(project.id, ownerId, {
        content: 'Test content',
        title: 'Test source',
        type: 'text',
      });
      assert.ok(source);

      await knowledgebaseRepository.upsertSourcePassages({
        blocks: [
          {
            id: 'block-0001',
            kind: 'paragraph',
            location: { label: 'Source / Block 1' },
            order: 0,
            sourceId: source.id,
            text: 'Test content here.',
          },
        ],
        projectId: project.id,
        sourceId: source.id,
      });

      await knowledgebaseRepository.mergeIngestionOutput({
        output: {
          concepts: [
            {
              conceptKey: 'concept-1',
              confidence: 0.9,
              definition: 'Definition for concept 1',
              difficulty: 'beginner',
              mergesWith: undefined,
              name: 'Concept One',
              sourceRefs: [],
            },
            {
              conceptKey: 'concept-2',
              confidence: 0.8,
              definition: 'Definition for concept 2',
              difficulty: 'advanced',
              mergesWith: undefined,
              name: 'Concept Two',
              sourceRefs: [],
            },
          ],
          relationClaims: [],
          relationships: [],
        },
        projectId: project.id,
        sourceId: source.id,
      });

      const result = await knowledgebaseRepository.searchConceptsWithPagination({
        projectId: project.id,
        limit: 1,
        offset: 0,
      });

      assert.equal(result.totalCount, 2);
      assert.equal(result.concepts.length, 1);
      assert.equal(result.concepts[0]?.name, 'Concept One');

      const resultWithQuery = await knowledgebaseRepository.searchConceptsWithPagination({
        projectId: project.id,
        query: 'Two',
        limit: 10,
        offset: 0,
      });

      assert.equal(resultWithQuery.totalCount, 1);
      assert.equal(resultWithQuery.concepts[0]?.name, 'Concept Two');

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

function embeddingVector(first: number, second: number) {
  return Array.from({ length: 1536 }, (_, index) => {
    if (index === 0) return first;
    if (index === 1) return second;
    return 0;
  });
}
