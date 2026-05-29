import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  chunkNormalizedBlocks,
  type IngestionConceptContext,
  normalizeMarkdownSource,
  type IngestionAgentOutput,
} from '@grasp/domain';
import {
  createDbClient,
  createKnowledgebaseRepository,
  createProjectRepository,
  createProjectSourceRepository,
  eq,
  schema,
} from '@grasp/db';
import { embedText, embedTexts } from '@grasp/ai/embeddings';
import {
  buildLinkCandidates,
  createIngestionRetrievalTools,
  extractChunk,
  type LinkTrace,
  mergeDraft,
  sourceLinkingWorkflow,
} from '@grasp/ai/ingestion';

const DOCS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/example');
const sourceA = readFileSync(resolve(DOCS_DIR, 'source-a-economics-basics.md'), 'utf-8');
const sourceB = readFileSync(resolve(DOCS_DIR, 'source-b-elasticity.md'), 'utf-8');
const sourceC = readFileSync(resolve(DOCS_DIR, 'source-c-total-revenue.md'), 'utf-8');
const debugRealTest = (...args: unknown[]) => {
  if (process.env.GRAPH_WALK_REAL_DEBUG === '1') {
    console.error('[graph-walk-real]', ...args);
  }
};

const hasDatabase = Boolean(process.env.DATABASE_URL);
const hasLlm = Boolean(
  process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
);
const hasEmbedding = Boolean(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.OPENAI_API_KEY
);
const databaseUrl = process.env.DATABASE_URL
  ? normalizeLocalDatabaseUrl(process.env.DATABASE_URL)
  : undefined;

const describeIfReal = hasDatabase && hasLlm && hasEmbedding ? describe : describe.skip;

describeIfReal('real ingestion graph walking', { timeout: 240_000 }, () => {
  if (!databaseUrl) {
    return;
  }

  let knowledgebaseRepository: ReturnType<typeof createKnowledgebaseRepository>;

  it(
    'ingests three sources and retrieves graph context through concept search plus neighbors',
    { timeout: 240_000 },
    async (t) => {
      const embeddingPreflight = await checkEmbeddingProvider();

      if (!embeddingPreflight.ok) {
        t.skip(`Embedding provider unreachable: ${embeddingPreflight.reason}`);
        return;
      }

      const db = createDbClient(databaseUrl);
      knowledgebaseRepository = createKnowledgebaseRepository(db);
      const projectRepository = createProjectRepository(db);
      const projectSourceRepository = createProjectSourceRepository(db);
      const ownerId = `graph-walk-real-test-${randomUUID()}`;

      await db.insert(schema.user).values({
        createdAt: new Date(),
        email: `${ownerId}@example.test`,
        emailVerified: true,
        id: ownerId,
        name: 'Graph Walk Real Test',
        updatedAt: new Date(),
      });

      const project = await projectRepository.create({
        description: 'Real ingestion graph walking test',
        ownerId,
        title: 'Real graph walking',
      });

      try {
        const sourceOne = await projectSourceRepository.createForProjectOwner(project.id, ownerId, {
          content: sourceA,
          title: 'Economics Basics',
          type: 'markdown',
        });
        const sourceTwo = await projectSourceRepository.createForProjectOwner(project.id, ownerId, {
          content: sourceB,
          title: 'Elasticity',
          type: 'markdown',
        });
        const sourceThree = await projectSourceRepository.createForProjectOwner(
          project.id,
          ownerId,
          {
            content: sourceC,
            title: 'Total Revenue',
            type: 'markdown',
          }
        );
        assert.ok(sourceOne);
        assert.ok(sourceTwo);
        assert.ok(sourceThree);

        debugRealTest('ingest source 1 start');
        await ingestSource(project.id, sourceOne.id, 'Economics Basics', sourceA);
        debugRealTest('ingest source 1 done');
        debugRealTest('ingest source 2 start');
        const sourceTwoRetrieval = await ingestSource(
          project.id,
          sourceTwo.id,
          'Elasticity',
          sourceB
        );
        debugRealTest('ingest source 2 done', sourceTwoRetrieval);
        assert.ok(
          sourceTwoRetrieval.conceptSearchCalls > 0,
          'Expected source 2 ingestion to search existing graph concepts'
        );
        assert.ok(
          sourceTwoRetrieval.conceptContextCalls > 0,
          'Expected source 2 ingestion to load existing concept context or neighbors'
        );
        assert.ok(
          sourceTwoRetrieval.linkTrace?.acceptedLinks.some(
            (link) =>
              link.sourceConceptKey === 'supply-and-demand' &&
              link.targetConceptKey === 'elasticity' &&
              link.relationshipType === 'prerequisite' &&
              link.evidenceQuality.finalEvidenceScore >= 0.6
          ),
          'Expected source 2 linking trace to accept supply-and-demand -> elasticity with usable evidence'
        );
        assert.ok(
          (sourceTwoRetrieval.linkTrace?.metrics.appliedCount ?? 0) >= 1,
          'Expected linking trace to apply at least the expected cross-source edge'
        );
        assert.ok(
          (sourceTwoRetrieval.linkTrace?.metrics.appliedCount ?? 0) <= 2,
          'Expected linking trace to keep accepted link count narrow for the economics fixture'
        );
        debugRealTest('ingest source 3 start');
        const sourceThreeRetrieval = await ingestSource(
          project.id,
          sourceThree.id,
          'Total Revenue',
          sourceC
        );
        debugRealTest('ingest source 3 done', sourceThreeRetrieval);
        assert.ok(
          sourceThreeRetrieval.conceptSearchCalls > 0,
          'Expected source 3 ingestion to search existing graph concepts'
        );
        assert.ok(
          sourceThreeRetrieval.conceptContextCalls > 0,
          'Expected source 3 ingestion to load existing concept context or neighbors'
        );
        assert.ok(
          sourceThreeRetrieval.linkTrace?.acceptedLinks.some(
            (link) =>
              link.sourceConceptKey === 'price-elasticity-of-demand' &&
              link.relationshipType === 'prerequisite' &&
              link.evidenceQuality.finalEvidenceScore >= 0.6
          ),
          'Expected source 3 linking trace to accept price elasticity of demand as a prerequisite with usable evidence'
        );

        const graph = await knowledgebaseRepository.findCurrentGraphByProject(project.id);
        assert.ok(graph);
        assert.ok(
          graph.concepts.length >= 4,
          `Expected at least 4 concepts, got ${graph.concepts.length}`
        );
        assert.ok(
          graph.relationships.length >= 1,
          `Expected at least 1 graph relationship, got ${graph.relationships.length}`
        );
        assert.ok(
          graph.relationships.some(
            (relationship) =>
              relationship.sourceConceptId === 'supply-and-demand' &&
              relationship.targetConceptId === 'elasticity' &&
              relationship.relationshipType === 'prerequisite'
          ),
          'Expected source 2 linking to link supply-and-demand -> elasticity as prerequisite'
        );
        const totalRevenueConcept = graph.concepts.find((concept) =>
          concept.id.includes('total-revenue')
        );
        assert.ok(totalRevenueConcept, 'Expected source 3 to add a total-revenue concept');
        assert.ok(
          graph.relationships.some(
            (relationship) =>
              relationship.sourceConceptId === 'price-elasticity-of-demand' &&
              relationship.targetConceptId === totalRevenueConcept.id &&
              relationship.relationshipType === 'prerequisite'
          ),
          'Expected source 3 linking to link price elasticity of demand -> total revenue as prerequisite'
        );
        for (const relationship of graph.relationships) {
          assert.ok(
            Array.isArray(relationship.sourceEvidence) && relationship.sourceEvidence.length > 0,
            `Expected relationship ${relationship.id} to have grounded evidence`
          );
        }

        const queryEmbedding = await embedText('market equilibrium and elasticity prerequisites');
        const semanticMatches = await knowledgebaseRepository.searchConceptsForIngestion({
          embedding: queryEmbedding,
          limit: 5,
          projectId: project.id,
          query: 'market equilibrium and elasticity prerequisites',
        });
        assert.ok(semanticMatches.length > 0, 'Expected semantic concept retrieval results');
        assert.equal(typeof semanticMatches[0]?.distance, 'number');

        const context = await knowledgebaseRepository.getConceptContext({
          conceptKey: 'elasticity',
          projectId: project.id,
        });

        assert.ok(context);
        assert.equal(context.concept.conceptKey, 'elasticity');
        assert.ok(context.evidence.length > 0, 'Expected graph context to include source evidence');
        assert.ok(
          context.neighbors.some(
            (neighbor) =>
              neighbor.conceptKey === 'supply-and-demand' &&
              neighbor.relationshipType === 'prerequisite'
          ),
          'Expected graph walker context for elasticity to include patched supply-and-demand prerequisite'
        );
        const priceElasticityContext = await knowledgebaseRepository.getConceptContext({
          conceptKey: 'price-elasticity-of-demand',
          projectId: project.id,
        });
        assert.ok(priceElasticityContext);
        assert.ok(
          priceElasticityContext.neighbors.some(
            (neighbor) =>
              neighbor.conceptKey === totalRevenueConcept.id &&
              neighbor.relationshipType === 'prerequisite'
          ),
          'Expected graph walker context for price elasticity of demand to include source 3 total-revenue neighbor'
        );
      } catch (error) {
        console.error('graph-walk-real failure', error);
        throw error;
      } finally {
        await db.delete(schema.projects).where(eq(schema.projects.id, project.id));
        await db.delete(schema.user).where(eq(schema.user.id, ownerId));
      }
    }
  );

  async function ingestSource(projectId: string, sourceId: string, title: string, content: string) {
    const retrievalActivity = {
      conceptContextCalls: 0,
      conceptSearchCalls: 0,
      linkTrace: null as LinkTrace | null,
    };
    const normalized = normalizeMarkdownSource({
      sourceId,
      sourceMaterial: content,
      title,
    });

    await knowledgebaseRepository.upsertSourcePassages({
      blocks: normalized.blocks,
      projectId,
      sourceId,
    });

    const chunks = chunkNormalizedBlocks(normalized.blocks);
    debugRealTest(title, 'chunks', chunks.length);
    let draft: IngestionAgentOutput = { concepts: [], relationClaims: [], relationships: [] };
    const retrievalTools = createIngestionRetrievalTools({
      getConceptContext: async (conceptKey) => {
        retrievalActivity.conceptContextCalls += 1;
        return knowledgebaseRepository.getConceptContext({
          conceptKey,
          projectId,
        });
      },
      searchWikiConcepts: async (query, limit) => {
        retrievalActivity.conceptSearchCalls += 1;
        const embedding = await embedText(query);

        return knowledgebaseRepository.searchConceptsForIngestion({
          embedding,
          limit,
          projectId,
          query,
        });
      },
    });

    for (const chunk of chunks) {
      debugRealTest(title, 'chunk', chunk.chunkIndex, 'retrieve start');
      const retrievedConcepts = await retrieveExistingConceptContext(
        projectId,
        chunk.blocks.map((block) => block.text),
        retrievalActivity
      );
      debugRealTest(title, 'chunk', chunk.chunkIndex, 'extract start', {
        retrievedConcepts: retrievedConcepts.length,
      });
      const result = await extractChunk({
        blocks: chunk.blocks.map((block) => ({ id: block.id, text: block.text })),
        chunkIndex: chunk.chunkIndex,
        draftConcepts: draft.concepts,
        draftRelationships: draft.relationships,
        retrievedConcepts,
        retrievalTools,
        sourceId,
        totalChunks: chunks.length,
      });

      if (result.concepts.length > 0) {
        draft = mergeDraft(draft, result);
      }
      debugRealTest(title, 'chunk', chunk.chunkIndex, 'extract done', {
        concepts: result.concepts.length,
        relationships: result.relationships.length,
      });
    }

    debugRealTest(title, 'build link candidates start');
    const linkCandidates = await buildLinkCandidates({
      getConceptContext: (conceptKey) =>
        knowledgebaseRepository.getConceptContext({
          conceptKey,
          projectId,
        }),
      localExtraction: draft,
      searchConcepts: async ({ query, limit }) =>
        knowledgebaseRepository.searchConceptsForIngestion({
          embedding: await embedText(query),
          limit,
          projectId,
          query,
        }),
    });
    debugRealTest(title, 'link candidates done', linkCandidates.length);
    const linkingRun = await sourceLinkingWorkflow.createRun({
      resourceId: projectId,
    });
    debugRealTest(title, 'linking workflow start');
    const linkingResult = await linkingRun.start({
      inputData: {
        candidates: linkCandidates,
        extraction: draft,
        useModel: true,
      },
    });
    debugRealTest(title, 'linking workflow done', linkingResult.status);
    assert.equal(linkingResult.status, 'success');
    draft = linkingResult.result?.patchedExtraction ?? draft;
    retrievalActivity.linkTrace = linkingResult.result?.trace ?? null;

    debugRealTest(title, 'concept embeddings start', draft.concepts.length);
    const embeddings = await embedTexts(
      draft.concepts.map((concept) => `${concept.name}\n\n${concept.definition}`)
    );
    const conceptEmbeddingsByKey: Record<string, number[]> = {};

    draft.concepts.forEach((concept, index) => {
      const embedding = embeddings[index];
      if (embedding) {
        conceptEmbeddingsByKey[concept.mergesWith ?? concept.conceptKey] = embedding;
      }
    });

    debugRealTest(title, 'merge output start', {
      concepts: draft.concepts.length,
      relationships: draft.relationships.length,
    });
    await knowledgebaseRepository.mergeIngestionOutput({
      conceptEmbeddingsByKey,
      output: draft,
      projectId,
      sourceId,
    });
    debugRealTest(title, 'merge output done');

    return retrievalActivity;
  }

  async function retrieveExistingConceptContext(
    projectId: string,
    blocks: string[],
    retrievalActivity: { conceptContextCalls: number; conceptSearchCalls: number }
  ): Promise<IngestionConceptContext[]> {
    const query = blocks.join('\n\n').slice(0, 1200).trim();

    if (!query) {
      return [];
    }

    retrievalActivity.conceptSearchCalls += 1;
    const concepts = await knowledgebaseRepository.searchConceptsForIngestion({
      embedding: await embedText(query),
      limit: 3,
      projectId,
      query,
    });

    const rawContexts = await Promise.all(
      concepts.slice(0, 2).map(async (concept) => {
        retrievalActivity.conceptContextCalls += 1;
        const context = await knowledgebaseRepository.getConceptContext({
          conceptKey: concept.conceptKey,
          projectId,
        });
        return context;
      })
    );

    return rawContexts.filter((c): c is IngestionConceptContext => c !== null);
  }
});

async function checkEmbeddingProvider(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const embedding = await embedText('graph walk real test embedding preflight');
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return { ok: false, reason: 'empty embedding response' };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizeLocalDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
  }

  return url.toString();
}
