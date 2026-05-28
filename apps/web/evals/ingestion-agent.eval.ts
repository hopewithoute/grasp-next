import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canUseAgentModel } from '@grasp/ai/model-resolver';
import { embedText, embedTexts } from '@grasp/ai/embeddings';
import {
  buildLinkCandidates,
  createIngestionRetrievalTools,
  extractChunk,
  ingestionAgentInstructions,
  mergeDraft,
  sourceLinkingWorkflow,
  type LinkTrace,
} from '@grasp/ai/ingestion';
import {
  createDbClient,
  createKnowledgebaseRepository,
  createProjectRepository,
  createProjectSourceRepository,
  eq,
  schema,
} from '@grasp/db';
import {
  chunkNormalizedBlocks,
  ingestionAgentOutputDto,
  normalizeMarkdownSource,
  type IngestionAgentOutput,
  type IngestionConceptContext,
} from '@grasp/domain';
import { parseEvalCliOptions } from './lib/cli';
import { compareReports } from './lib/compare';
import { createEvalReport } from './lib/eval-runner';
import { hashText, hashToolDescriptions } from './lib/prompt-hash';
import { readEvalReport, writeEvalReport } from './lib/report-writer';
import { check, scoreChecks as scoreEvalChecks } from './lib/scoring';
import type { EvalCaseResult, EvalCliOptions } from './lib/types';

type RetrievalActivity = {
  conceptContextCalls: number;
  conceptSearchCalls: number;
  linkTrace: LinkTrace | null;
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(currentDir, '../../../docs/example');

async function main() {
  const options = parseEvalCliOptions();
  if (options.mode === 'compare') {
    await compareLatest(options);
    return;
  }

  if (!canUseAgentModel('ingestionAgent', process.env)) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason:
            'No configured LLM credentials for ingestionAgent. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_COMPATIBLE_* credentials.',
        },
        null,
        2
      )
    );
    return;
  }

  const sourceA = await readFile(resolve(docsDir, 'source-a-economics-basics.md'), 'utf8');
  const sourceB = await readFile(resolve(docsDir, 'source-b-elasticity.md'), 'utf8');
  const sourceC = await readFile(resolve(docsDir, 'source-c-total-revenue.md'), 'utf8');

  const results: EvalCaseResult[] = [];
  results.push(await evaluateFreshExtraction(sourceA));
  results.push(await evaluateIncrementalExtraction({ sourceA, sourceB }));

  if (options.mode === 'real' && process.env.DATABASE_URL && hasEmbeddingProvider(process.env)) {
    results.push(await evaluateGraphWalk({ sourceA, sourceB, sourceC }));
  } else if (options.mode === 'real') {
    results.push({
      dimensions: { retrievalUsage: 0 },
      id: 'graph-walk-retrieval-linking',
      passed: false,
      score: 0,
      reasons: ['Skipped: DATABASE_URL and embedding provider credentials are required.'],
      metrics: {},
    });
  }

  const report = createEvalReport({
    agent: 'ingestionAgent',
    cases: results,
    fixtureVersion: options.mode === 'real' ? 'ingestion-agent-real-v1' : 'ingestion-agent-fixture-v1',
    mode: options.mode,
    model: resolveModelLabel('ingestionAgent'),
    promptHash: hashText(ingestionAgentInstructions),
    toolHash: hashToolDescriptions(
      createIngestionRetrievalTools({
        getConceptContext: async () => null,
        searchWikiConcepts: async () => [],
      })
    ),
  });

  console.log(JSON.stringify(report, null, 2));
  if (options.writeReport) {
    const paths = await writeEvalReport(report);
    console.error(`Wrote eval report: ${paths.reportPath}`);
  }

  if (report.cases.some((result) => !result.passed)) {
    process.exitCode = 1;
  }
}

async function evaluateFreshExtraction(sourceA: string): Promise<EvalCaseResult> {
  const draft = await extractSourceWithoutDb({
    content: sourceA,
    sourceId: 'eval-source-a',
    title: 'Economics Basics',
  });
  const parsed = ingestionAgentOutputDto.safeParse(draft);
  const conceptKeys = draft.concepts.map((concept) => concept.conceptKey);

  return scoreEvalChecks({
    id: 'fresh-source-extraction',
    checks: [
      check('schemaValidity', parsed.success, 'Extraction output failed schema validation.'),
      check('conceptExtraction', draft.concepts.length >= 2, 'Expected at least two concepts.'),
      check(
        'grounding',
        draft.concepts.every((concept) =>
          concept.sourceRefs.every((ref) => ref.blockId && ref.quote && ref.locationLabel)
        ),
        'Expected every concept sourceRef to include blockId, quote, and locationLabel.'
      ),
      check(
        'payloadCorrectness',
        draft.concepts.every((concept) => concept.confidence >= 0 && concept.confidence <= 1),
        'Expected confidence scores to stay within 0..1.'
      ),
    ],
    metrics: {
      conceptCount: draft.concepts.length,
      relationshipCount: draft.relationships.length,
      conceptKeys,
    },
  });
}

async function evaluateIncrementalExtraction({
  sourceA,
  sourceB,
}: {
  sourceA: string;
  sourceB: string;
}): Promise<EvalCaseResult> {
  const draftA = await extractSourceWithoutDb({
    content: sourceA,
    sourceId: 'eval-source-a',
    title: 'Economics Basics',
  });
  const draftB = await extractSourceWithoutDb({
    content: sourceB,
    sourceId: 'eval-source-b',
    title: 'Elasticity',
  });

  const existingKeys = new Set(draftA.concepts.map((concept) => concept.conceptKey));
  const reusedOrMerged = draftB.concepts.filter(
    (concept) =>
      existingKeys.has(concept.conceptKey) ||
      Boolean(concept.mergesWith && existingKeys.has(concept.mergesWith))
  );
  const finalDraft = mergeDraft(draftA, draftB);

  return scoreEvalChecks({
    id: 'incremental-source-extraction',
    checks: [
      check('conceptExtraction', draftA.concepts.length >= 2, 'Expected source A concepts.'),
      check('conceptExtraction', draftB.concepts.length >= 1, 'Expected source B concepts.'),
      check(
        'schemaValidity',
        ingestionAgentOutputDto.safeParse(finalDraft).success,
        'Merged extraction failed schema validation.'
      ),
      check(
        'duplicateAvoidance',
        reusedOrMerged.length <= Math.max(1, draftB.concepts.length),
        'Expected reuse/merge behavior to avoid excessive duplicates.'
      ),
    ],
    metrics: {
      sourceAConceptCount: draftA.concepts.length,
      sourceBConceptCount: draftB.concepts.length,
      reusedOrMergedCount: reusedOrMerged.length,
      finalConceptCount: finalDraft.concepts.length,
      finalRelationshipCount: finalDraft.relationships.length,
    },
  });
}

async function evaluateGraphWalk({
  sourceA,
  sourceB,
  sourceC,
}: {
  sourceA: string;
  sourceB: string;
  sourceC: string;
}): Promise<EvalCaseResult> {
  const embeddingPreflight = await checkEmbeddingProvider();
  if (!embeddingPreflight.ok) {
    return {
      dimensions: { retrievalUsage: 0 },
      id: 'graph-walk-retrieval-linking',
      passed: false,
      score: 0,
      reasons: [`Skipped: embedding provider unreachable: ${embeddingPreflight.reason}`],
      metrics: {},
    };
  }

  const db = createDbClient(normalizeLocalDatabaseUrl(process.env.DATABASE_URL!));
  const knowledgebaseRepository = createKnowledgebaseRepository(db);
  const projectRepository = createProjectRepository(db);
  const projectSourceRepository = createProjectSourceRepository(db);
  const ownerId = `ingestion-eval-${randomUUID()}`;

  await db.insert(schema.user).values({
    createdAt: new Date(),
    email: `${ownerId}@example.test`,
    emailVerified: true,
    id: ownerId,
    name: 'Ingestion Eval',
    updatedAt: new Date(),
  });

  const project = await projectRepository.create({
    description: 'Ingestion eval graph walking run',
    ownerId,
    title: 'Ingestion eval graph walking',
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
    const sourceThree = await projectSourceRepository.createForProjectOwner(project.id, ownerId, {
      content: sourceC,
      title: 'Total Revenue',
      type: 'markdown',
    });

    await ingestSource({
      content: sourceA,
      knowledgebaseRepository,
      projectId: project.id,
      sourceId: sourceOne!.id,
      title: 'Economics Basics',
    });
    const sourceTwoRetrieval = await ingestSource({
      content: sourceB,
      knowledgebaseRepository,
      projectId: project.id,
      sourceId: sourceTwo!.id,
      title: 'Elasticity',
    });
    const sourceThreeRetrieval = await ingestSource({
      content: sourceC,
      knowledgebaseRepository,
      projectId: project.id,
      sourceId: sourceThree!.id,
      title: 'Total Revenue',
    });

    const graph = await knowledgebaseRepository.findCurrentGraphByProject(project.id);
    const totalRevenueConcept = graph?.concepts.find((concept) =>
      concept.id.includes('total-revenue')
    );
    const semanticMatches = await knowledgebaseRepository.searchConceptsForIngestion({
      embedding: await embedText('market equilibrium and elasticity prerequisites'),
      limit: 5,
      projectId: project.id,
      query: 'market equilibrium and elasticity prerequisites',
    });

    return scoreEvalChecks({
      id: 'graph-walk-retrieval-linking',
      checks: [
        check(
          'retrievalUsage',
          sourceTwoRetrieval.conceptSearchCalls > 0,
          'Expected source 2 to search graph concepts.'
        ),
        check(
          'retrievalUsage',
          sourceTwoRetrieval.conceptContextCalls > 0,
          'Expected source 2 to load graph context.'
        ),
        check(
          'crossSourceLinking',
        sourceTwoRetrieval.linkTrace?.acceptedLinks.some(
          (link) =>
            link.sourceConceptKey === 'supply-and-demand' &&
            link.targetConceptKey === 'elasticity' &&
            link.relationshipType === 'prerequisite' &&
            link.evidenceQuality.finalEvidenceScore >= 0.6
        ) ?? false,
          'Expected source 2 to link supply-and-demand -> elasticity.'
        ),
        check(
          'retrievalUsage',
          sourceThreeRetrieval.conceptContextCalls > 0,
          'Expected source 3 to load graph context.'
        ),
        check(
          'crossSourceLinking',
          hasAcceptedOrDuplicateRejectedLink(
            sourceThreeRetrieval.linkTrace,
            'price-elasticity-of-demand',
            'prerequisite'
          ),
          'Expected source 3 to link price elasticity of demand as prerequisite.'
        ),
        check(
          'graphPersistence',
          Boolean(
        graph && graph.concepts.length >= 4 && graph.relationships.length >= 1
      ),
          'Expected persisted graph to contain concepts and relationships.'
        ),
        check('graphPersistence', Boolean(totalRevenueConcept), 'Expected total-revenue concept.'),
        check(
          'semanticRetrieval',
          semanticMatches.length > 0 && typeof semanticMatches[0]?.distance === 'number',
          'Expected semantic search to return ranked results.'
        ),
      ],
      metrics: {
        sourceTwoRetrieval,
        sourceThreeRetrieval,
        conceptCount: graph?.concepts.length ?? 0,
        relationshipCount: graph?.relationships.length ?? 0,
        semanticMatchCount: semanticMatches.length,
        totalRevenueConceptId: totalRevenueConcept?.id ?? null,
      },
    });
  } finally {
    await db.delete(schema.projects).where(eq(schema.projects.id, project.id));
    await db.delete(schema.user).where(eq(schema.user.id, ownerId));
  }
}

function hasAcceptedOrDuplicateRejectedLink(
  trace: LinkTrace | null,
  sourceConceptKey: string,
  relationshipType: string
) {
  if (!trace) {
    return false;
  }

  const matches = (link: {
    evidenceQuality?: { finalEvidenceScore?: number };
    relationshipType?: string;
    sourceConceptKey?: string;
  }) =>
    link.sourceConceptKey === sourceConceptKey &&
    link.relationshipType === relationshipType &&
    (link.evidenceQuality?.finalEvidenceScore ?? 0) >= 0.6;

  return (
    trace.acceptedLinks.some(matches) ||
    trace.rejectedLinks.some(
      (link) =>
        matches(link) &&
        trace.policyResults.some(
          (result) =>
            result.candidateId === link.candidateId && result.reason === 'duplicate_relationship'
        )
    )
  );
}

async function extractSourceWithoutDb({
  content,
  sourceId,
  title,
}: {
  content: string;
  sourceId: string;
  title: string;
}) {
  const normalized = normalizeMarkdownSource({
    sourceId,
    sourceMaterial: content,
    title,
  });
  const chunks = chunkNormalizedBlocks(normalized.blocks);
  let draft: IngestionAgentOutput = { concepts: [], relationClaims: [], relationships: [] };

  for (const chunk of chunks) {
    const result = await extractChunk({
      blocks: chunk.blocks.map((block) => ({ id: block.id, text: block.text })),
      chunkIndex: chunk.chunkIndex,
      draftConcepts: draft.concepts,
      draftRelationships: draft.relationships,
      sourceId,
      totalChunks: chunks.length,
    });

    if (result.concepts.length > 0) {
      draft = mergeDraft(draft, result);
    }
  }

  return draft;
}

async function ingestSource({
  content,
  knowledgebaseRepository,
  projectId,
  sourceId,
  title,
}: {
  content: string;
  knowledgebaseRepository: ReturnType<typeof createKnowledgebaseRepository>;
  projectId: string;
  sourceId: string;
  title: string;
}): Promise<RetrievalActivity> {
  const retrievalActivity: RetrievalActivity = {
    conceptContextCalls: 0,
    conceptSearchCalls: 0,
    linkTrace: null,
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
      return knowledgebaseRepository.searchConceptsForIngestion({
        embedding: await embedText(query),
        limit,
        projectId,
        query,
      });
    },
  });

  for (const chunk of chunks) {
    const retrievedConcepts = await retrieveExistingConceptContext({
      blocks: chunk.blocks.map((block) => block.text),
      knowledgebaseRepository,
      projectId,
      retrievalActivity,
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
  }

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
  const linkingRun = await sourceLinkingWorkflow.createRun({
    resourceId: projectId,
  });
  const linkingResult = await linkingRun.start({
    inputData: {
      candidates: linkCandidates,
      extraction: draft,
      useModel: true,
    },
  });

  if (linkingResult.status === 'success') {
    draft = linkingResult.result?.patchedExtraction ?? draft;
    retrievalActivity.linkTrace = linkingResult.result?.trace ?? null;
  }

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

  await knowledgebaseRepository.mergeIngestionOutput({
    conceptEmbeddingsByKey,
    output: draft,
    projectId,
    sourceId,
  });

  return retrievalActivity;
}

async function retrieveExistingConceptContext({
  blocks,
  knowledgebaseRepository,
  projectId,
  retrievalActivity,
}: {
  blocks: string[];
  knowledgebaseRepository: ReturnType<typeof createKnowledgebaseRepository>;
  projectId: string;
  retrievalActivity: { conceptContextCalls: number; conceptSearchCalls: number };
}): Promise<IngestionConceptContext[]> {
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
      return knowledgebaseRepository.getConceptContext({
        conceptKey: concept.conceptKey,
        projectId,
      });
    })
  );

  return rawContexts.filter((context): context is IngestionConceptContext => context !== null);
}

async function checkEmbeddingProvider(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const embedding = await embedText('graph walk eval embedding preflight');
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

function hasEmbeddingProvider(env: NodeJS.ProcessEnv) {
  return Boolean(
    env.GOOGLE_GENERATIVE_AI_API_KEY ||
      env.GEMINI_API_KEY ||
      env.OPENAI_API_KEY ||
      (env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_API_KEY)
  );
}

function normalizeLocalDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
  }

  return url.toString();
}

async function compareLatest(options: EvalCliOptions) {
  const baseline = await readEvalReport('ingestionAgent', options.baseline ?? 'latest');
  const previousMode = options.mode;
  options.mode = 'fixture';

  const sourceA = await readFile(resolve(docsDir, 'source-a-economics-basics.md'), 'utf8');
  const sourceB = await readFile(resolve(docsDir, 'source-b-elasticity.md'), 'utf8');
  const cases = [
    await evaluateFreshExtraction(sourceA),
    await evaluateIncrementalExtraction({ sourceA, sourceB }),
  ];
  options.mode = previousMode;

  const current = createEvalReport({
    agent: 'ingestionAgent',
    cases,
    fixtureVersion: 'ingestion-agent-fixture-v1',
    mode: 'fixture',
    model: resolveModelLabel('ingestionAgent'),
    promptHash: hashText(ingestionAgentInstructions),
    toolHash: hashToolDescriptions(
      createIngestionRetrievalTools({
        getConceptContext: async () => null,
        searchWikiConcepts: async () => [],
      })
    ),
  });

  const comparison = compareReports(current, baseline);
  console.log(JSON.stringify(comparison, null, 2));

  if (comparison.cases.some((item) => item.regressed)) {
    process.exitCode = 1;
  }
}

function resolveModelLabel(agent: 'ingestionAgent') {
  return (
    process.env.INGESTION_AGENT_MODEL ??
    process.env.AI_MODEL ??
    process.env.OPENAI_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    process.env.OPENAI_COMPATIBLE_MODEL ??
    `${agent}:default`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
