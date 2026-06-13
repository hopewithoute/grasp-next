import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canUseAgent } from '@grasp/ai';
import { embedText } from '@grasp/ai/embeddings';
import { createFaithfulnessScorer, createHallucinationScorer, createScorer } from '@grasp/ai/evals';
import {
  createIngestionRetrievalTools,
  extractChunk,
  ingestionAgentInstructions,
} from '@grasp/ai/legacy-ingestion';
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
  mergeDraft,
  normalizeMarkdownSource,
  safeParse,
  type IngestionAgentOutput,
  type IngestionRunRepository,
  type KnowledgebaseRepository,
  type LinkTrace,
} from '@grasp/domain';
import { serverEnv } from '../../server/env';
import { parseEvalCliOptions } from '../lib/cli';
import { compareReports } from '../lib/compare';
import { createEvalReport } from '../lib/eval-runner';
import { hashText, hashToolDescriptions } from '../lib/prompt-hash';
import { readEvalReport, writeEvalReport } from '../lib/report-writer';
import type { EvalCaseResult, EvalCliOptions } from '../lib/types';

// ─── Scorers ────────────────────────────────────────────────────────────────

const schemaValidityScorer = createScorer({
  id: 'schema-validity',
  description: 'Validates extraction output matches ingestionAgentOutputDto schema',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const parsed = safeParse(ingestionAgentOutputDto, run.output);
    return { valid: parsed.success };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.valid ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

const conceptExtractionScorer = createScorer({
  id: 'concept-extraction',
  description: 'Validates that extraction produced a minimum number of concepts',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionAgentOutput;
    return { count: output.concepts?.length ?? 0 };
  })
  .analyze(({ results, run }) => {
    const min = typeof run.groundTruth === 'number' ? run.groundTruth : 2;
    return {
      score: results.preprocessStepResult.count >= min ? 1 : 0,
      count: results.preprocessStepResult.count,
      min,
    };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);

const groundingScorer = createScorer({
  id: 'grounding',
  description: 'Validates every concept sourceRef includes blockId, quote, and locationLabel',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionAgentOutput;
    const allGrounded = output.concepts.every((concept) =>
      concept.sourceRefs.every((ref) => ref.blockId && ref.quote && ref.locationLabel)
    );
    return { allGrounded };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.allGrounded ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

const confidenceRangeScorer = createScorer({
  id: 'confidence-range',
  description: 'Validates concept confidence scores stay within 0..1',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionAgentOutput;
    const allValid = output.concepts.every(
      (concept) => concept.confidence >= 0 && concept.confidence <= 1
    );
    return { allValid };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.allValid ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

const duplicateAvoidanceScorer = createScorer({
  id: 'duplicate-avoidance',
  description: 'Validates incremental merge avoids excessive concept duplication',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionAgentOutput;
    const concepts = output.concepts;
    const existingKeys = new Set((run.groundTruth as Set<string> | undefined) ?? new Set<string>());
    const reusedOrMerged = concepts.filter(
      (concept) =>
        existingKeys.has(concept.conceptKey) ||
        Boolean(concept.mergesWith && existingKeys.has(concept.mergesWith))
    );
    return {
      total: concepts.length,
      reusedOrMerged: reusedOrMerged.length,
    };
  })
  .analyze(({ results }) => {
    const { total, reusedOrMerged } = results.preprocessStepResult;
    const maxDuplicates = Math.max(1, total);
    return { score: reusedOrMerged <= maxDuplicates ? 1 : 0 };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);

const emptySourceScorer = createScorer({
  id: 'empty-source-graceful',
  description: 'Validates empty or trivial source produces 0-1 concepts without error',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionAgentOutput;
    return { count: output.concepts?.length ?? 0 };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.count <= 1 ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

const shortSourceScorer = createScorer({
  id: 'short-source-bounds',
  description: 'Validates short source produces a bounded number of concepts',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionAgentOutput;
    return { count: output.concepts?.length ?? 0 };
  })
  .analyze(({ results }) => ({
    score:
      results.preprocessStepResult.count >= 1 && results.preprocessStepResult.count <= 3 ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

const technicalDepthScorer = createScorer({
  id: 'technical-depth',
  description: 'Validates technical source produces multiple teachable concepts',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionAgentOutput;
    const concepts = output.concepts ?? [];
    const allHaveDefinitions = concepts.every((c) => c.definition && c.definition.length > 10);
    return {
      count: concepts.length,
      allHaveDefinitions,
      relationshipCount: output.relationships?.length ?? 0,
    };
  })
  .analyze(({ results }) => {
    const { count, allHaveDefinitions } = results.preprocessStepResult;
    return { score: count >= 3 && allHaveDefinitions ? 1 : 0 };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);

const crossSourceDedupScorer = createScorer({
  id: 'cross-source-dedup',
  description: 'Validates multi-source extraction avoids excessive duplicates',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionAgentOutput;
    const concepts = output.concepts ?? [];
    const uniqueKeys = new Set(concepts.map((c) => c.conceptKey));
    const merged = concepts.filter((c) => c.mergesWith);
    return {
      total: concepts.length,
      unique: uniqueKeys.size,
      mergedCount: merged.length,
      duplicateRatio: concepts.length > 0 ? 1 - uniqueKeys.size / concepts.length : 0,
    };
  })
  .analyze(({ results }) => {
    const { duplicateRatio } = results.preprocessStepResult;
    return { score: duplicateRatio <= 0.4 ? 1 : 0 };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);

const relationshipTypeScorer = createScorer({
  id: 'relationship-type-validity',
  description:
    'Validates all relationship types are valid (prerequisite, part_of, related_to, explains)',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionAgentOutput;
    const validTypes = new Set([
      'prerequisite',
      'part_of',
      'related_to',
      'explains',
      'connects_to',
      'builds_on',
      'influences',
      'requires',
      'depends_on',
    ]);
    const rels = output.relationships ?? [];
    const allValid = rels.every((r) =>
      validTypes.has((r as { relationshipType?: string }).relationshipType || '')
    );
    return { total: rels.length, allValid };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.allValid ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

const retrievalUsageScorer = createScorer({
  id: 'retrieval-usage',
  description: 'Validates that graph walk made concept context and search calls',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const activity = run.output as unknown as {
      conceptContextCalls: number;
      conceptSearchCalls: number;
    };
    return {
      contextCalls: activity.conceptContextCalls,
      searchCalls: activity.conceptSearchCalls,
    };
  })
  .analyze(({ results }) => {
    const { contextCalls, searchCalls } = results.preprocessStepResult;
    return {
      score: contextCalls > 0 && searchCalls > 0 ? 1 : 0,
      contextCalls,
      searchCalls,
    };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);

// ─── LLM Judge scorers (from @mastra/evals) ─────────────────────────────────

function getJudgeModel() {
  return resolveModelLabel();
}

function buildFaithfulnessScorer(context: string[]) {
  const model = getJudgeModel();
  if (!model) {
    return null;
  }
  return createFaithfulnessScorer({
    model,
    options: { context },
  });
}

function buildHallucinationScorer(context: string[]) {
  const model = getJudgeModel();
  if (!model) return null;
  return createHallucinationScorer({
    model,
    options: { context },
  });
}

// ─── Pipeline helpers ────────────────────────────────────────────────────────

type RetrievalActivity = {
  conceptContextCalls: number;
  conceptSearchCalls: number;
  linkTrace: LinkTrace | null;
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(currentDir, '../../../../docs/example');

async function extractSourceWithoutDb({
  content,
  sourceId,
  title,
}: {
  content: string;
  sourceId: string;
  title: string;
}): Promise<IngestionAgentOutput> {
  const normalized = normalizeMarkdownSource({
    sourceMaterial: content,
    sourceId,
    title,
  });
  const chunks = chunkNormalizedBlocks(normalized.blocks);
  let draft: IngestionAgentOutput = {
    concepts: [],
    relationClaims: [],
    relationships: [],
  };

  for (const chunk of chunks) {
    const result = await extractChunk({
      blocks: chunk.blocks.map((block) => ({ id: block.id, text: block.text })),
      chunkIndex: chunk.chunkIndex,
      draftConcepts: draft.concepts,
      draftRelationships: draft.relationships,
      sourceId,
      totalChunks: chunks.length,
    });
    draft = mergeDraft(draft, result);
  }

  return draft;
}

async function runGraphWalk({
  sourceA,
  sourceB,
  sourceC,
}: {
  sourceA: string;
  sourceB: string;
  sourceC: string;
}): Promise<RetrievalActivity> {
  void sourceA;
  void sourceB;
  void sourceC;
  throw new Error('legacy_graph_walk_eval_retired_after_lgs_cutover');
}

/*
  const db = createDbClient(normalizeLocalDatabaseUrl(serverEnv.DATABASE_URL));
  const knowledgebaseRepository = createKnowledgebaseRepository(db);
  const projectRepository = createProjectRepository(db);
  const projectSourceRepository = createProjectSourceRepository(db);
  const { createIngestionRunRepository } = await import('@grasp/db');
  const ingestionRunRepository = createIngestionRunRepository(db);
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

  const retrievalActivity: RetrievalActivity = {
    conceptContextCalls: 0,
    conceptSearchCalls: 0,
    linkTrace: null,
  };

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
    if (!sourceOne?.content || !sourceTwo?.content) {
      throw new Error('ingestion_eval_source_create_failed');
    }

    await ingestSourceWithRetrieval({
      knowledgebaseRepository,
      ingestionRunRepository,
      projectId: project.id,
      retrievalActivity,
      source: { content: sourceOne.content, title: sourceOne.title },
      sourceId: sourceOne.id,
    });
    await ingestSourceWithRetrieval({
      knowledgebaseRepository,
      ingestionRunRepository,
      projectId: project.id,
      retrievalActivity,
      source: { content: sourceTwo.content, title: sourceTwo.title },
      sourceId: sourceTwo.id,
    });

    const sourceThree = await projectSourceRepository.createForProjectOwner(project.id, ownerId, {
      content: sourceC,
      title: 'Total Revenue',
      type: 'markdown',
    });
    if (!sourceThree?.content) {
      throw new Error('ingestion_eval_source_create_failed');
    }
    await ingestSourceWithRetrieval({
      knowledgebaseRepository,
      ingestionRunRepository,
      projectId: project.id,
      retrievalActivity,
      source: { content: sourceThree.content, title: sourceThree.title },
      sourceId: sourceThree.id,
    });
  } finally {
    await db.delete(schema.user).where(eq(schema.user.id, ownerId));
  }

  return retrievalActivity;
}
*/

async function ingestSourceWithRetrieval({
  knowledgebaseRepository,
  ingestionRunRepository,
  projectId,
  retrievalActivity,
  source,
  sourceId,
}: {
  knowledgebaseRepository: KnowledgebaseRepository;
  ingestionRunRepository: IngestionRunRepository;
  projectId: string;
  retrievalActivity: RetrievalActivity;
  source: { content: string; title: string };
  sourceId: string;
}): Promise<void> {
  void knowledgebaseRepository;
  void ingestionRunRepository;
  void projectId;
  void retrievalActivity;
  void source;
  void sourceId;
  throw new Error('legacy_graph_walk_ingestion_retired_after_lgs_cutover');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  return url.toString();
}

function resolveModelLabel() {
  return (
    serverEnv.INGESTION_AGENT_MODEL ??
    serverEnv.AI_MODEL ??
    serverEnv.OPENAI_MODEL ??
    serverEnv.ANTHROPIC_MODEL ??
    process.env.OPENAI_COMPATIBLE_MODEL ??
    'ingestionAgent:default'
  );
}

// ─── Scorer runner helper ────────────────────────────────────────────────────

async function scoreCase(
  id: string,
  output: unknown,
  scorers: Array<{ id: string; run: (opts: never) => Promise<unknown> }>,
  opts: { groundTruth?: unknown; metrics?: Record<string, unknown>; sourceText?: string } = {}
): Promise<EvalCaseResult> {
  const dimensions: Record<string, number> = {};
  const reasons: string[] = [];

  // Custom scorers
  const scorerResults = await Promise.all(
    scorers.map(async (scorer) => {
      const result = await scorer.run({
        output,
        groundTruth: opts.groundTruth,
      } as never);
      return { id: scorer.id, ...(result as { score?: unknown; reason?: unknown }) };
    })
  );
  for (const { id, score, reason } of scorerResults) {
    if (typeof score === 'number') {
      dimensions[id] = score;
    }
    if (reason) {
      reasons.push(String(reason));
    }
  }

  // LLM judges (when source text available)
  if (opts.sourceText) {
    const draft = output as IngestionAgentOutput;
    const context = draft.concepts.map((c) => `${c.name}: ${c.definition}`);

    if (context.length > 0) {
      const faithScorer = buildFaithfulnessScorer([opts.sourceText]);
      if (faithScorer) {
        try {
          const result = await faithScorer.run({
            input: 'Extract concepts from source',
            output: context.join('\n'),
          });
          const score = (result as { score?: unknown }).score;
          if (typeof score === 'number') dimensions['faithfulness'] = score;
        } catch (error) {
          console.error(error);
        }
      }

      try {
        const hallucScorer = buildHallucinationScorer([opts.sourceText]);
        if (hallucScorer) {
          const result = await hallucScorer.run({
            input: 'Extract concepts from source',
            output: context.join('\n'),
          });
          // Hallucination: 0=no hallucination (good), 1=full hallucination (bad). Invert for scoring.
          const hallucRaw = (result as { score?: unknown }).score;
          if (typeof hallucRaw === 'number') dimensions['hallucination'] = 1 - hallucRaw;
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  const scoreValues = Object.values(dimensions).filter((v): v is number => typeof v === 'number');
  const score =
    scoreValues.length === 0 ? 1 : scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;

  return {
    id,
    passed: score === 1,
    score,
    dimensions,
    reasons,
    metrics: opts.metrics ?? {},
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const options = parseEvalCliOptions();
  if (options.mode === 'compare') {
    await compareLatest(options);
    return;
  }

  if (!canUseAgent()) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason:
            'No configured LLM credentials. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, XIAOMI_API_KEY, or AI_MODEL.',
        },
        null,
        2
      )
    );
    return;
  }

  const [sourceA, sourceB, sourceC] = await Promise.all([
    readFile(resolve(docsDir, 'source-a-economics-basics.md'), 'utf8'),
    readFile(resolve(docsDir, 'source-b-elasticity.md'), 'utf8'),
    readFile(resolve(docsDir, 'source-c-total-revenue.md'), 'utf8'),
  ]);

  console.error(`[Eval] Starting Ingestion Eval...`);
  const results: EvalCaseResult[] = [];

  // Case 1: Fresh extraction
  const freshDraft = await extractSourceWithoutDb({
    content: sourceA,
    sourceId: 'eval-source-a',
    title: 'Economics Basics',
  });
  results.push(
    await scoreCase(
      'fresh-source-extraction',
      freshDraft,
      [schemaValidityScorer, conceptExtractionScorer, groundingScorer, confidenceRangeScorer],
      {
        groundTruth: 2,
        sourceText: sourceA,
        metrics: {
          conceptCount: freshDraft.concepts.length,
          relationshipCount: freshDraft.relationships.length,
          conceptKeys: freshDraft.concepts.map((c) => c.conceptKey),
        },
      }
    )
  );
  console.error(
    `[Eval] Case 'fresh-source-extraction' completed: ${results[results.length - 1].passed ? 'PASSED' : 'FAILED'} (Score: ${results[results.length - 1].score.toFixed(2)})`
  );

  // Case 2: Incremental extraction
  console.error(`[Eval] Running 'incremental-source-extraction'...`);
  const draftA = freshDraft;
  const draftB = await extractSourceWithoutDb({
    content: sourceB,
    sourceId: 'eval-source-b',
    title: 'Elasticity',
  });
  const existingKeys = new Set(draftA.concepts.map((c) => c.conceptKey));
  const finalDraft = mergeDraft(draftA, draftB);

  results.push(
    await scoreCase(
      'incremental-source-extraction',
      finalDraft,
      [conceptExtractionScorer, schemaValidityScorer, duplicateAvoidanceScorer],
      {
        groundTruth: existingKeys,
        metrics: {
          sourceAConceptCount: draftA.concepts.length,
          sourceBConceptCount: draftB.concepts.length,
          finalConceptCount: finalDraft.concepts.length,
          finalRelationshipCount: finalDraft.relationships.length,
        },
      }
    )
  );
  console.error(
    `[Eval] Case 'incremental-source-extraction' completed: ${results[results.length - 1].passed ? 'PASSED' : 'FAILED'} (Score: ${results[results.length - 1].score.toFixed(2)})`
  );

  // Case 3: Legacy graph walk was retired when source ingestion moved to LGS.
  console.error(`[Eval] Checking graph-walk...`);
  if (options.mode === 'real') {
    results.push({
      dimensions: { 'retrieval-usage': 0 },
      id: 'graph-walk-retrieval-linking',
      passed: false,
      score: 0,
      reasons: ['Skipped: legacy graph-walk eval retired after LGS cutover. Use LGS smoke/parity tests.'],
      metrics: {},
    });
  }

  // ─── Edge Cases ──────────────────────────────────────────────────────────
  console.error(`[Eval] Running edge cases (empty, short, technical)...`);
  const fixturesDir = resolve(currentDir, '../../../../docs/example/fixtures');

  const [emptySource, shortSource, techSource] = await Promise.all([
    readFile(resolve(fixturesDir, 'source-empty.md'), 'utf8'),
    readFile(resolve(fixturesDir, 'source-short.md'), 'utf8'),
    readFile(resolve(fixturesDir, 'source-technical.md'), 'utf8'),
  ]);

  const [emptyDraft, shortDraft, techDraft] = await Promise.all([
    extractSourceWithoutDb({ content: emptySource, sourceId: 'eval-empty', title: 'Empty Source' }),
    extractSourceWithoutDb({
      content: shortSource,
      sourceId: 'eval-short',
      title: 'Photosynthesis',
    }),
    extractSourceWithoutDb({
      content: techSource,
      sourceId: 'eval-technical',
      title: 'Kubernetes Architecture',
    }),
  ]);

  results.push(
    await scoreCase('empty-source', emptyDraft, [emptySourceScorer, schemaValidityScorer], {
      metrics: { conceptCount: emptyDraft.concepts.length },
    })
  );

  results.push(
    await scoreCase(
      'short-source',
      shortDraft,
      [shortSourceScorer, schemaValidityScorer, groundingScorer],
      {
        metrics: { conceptCount: shortDraft.concepts.length },
      }
    )
  );
  results.push(
    await scoreCase(
      'technical-jargon-heavy',
      techDraft,
      [
        technicalDepthScorer,
        schemaValidityScorer,
        groundingScorer,
        confidenceRangeScorer,
        relationshipTypeScorer,
      ],
      {
        metrics: {
          conceptCount: techDraft.concepts.length,
          relationshipCount: techDraft.relationships.length,
        },
      }
    )
  );
  console.error(
    `[Eval] Case 'technical-jargon-heavy' completed: ${results[results.length - 1].passed ? 'PASSED' : 'FAILED'} (Score: ${results[results.length - 1].score.toFixed(2)})`
  );

  // Cross-source dedup (merge source-a with source-b again)
  const crossDedupDraft = mergeDraft(draftA, draftB);
  results.push(
    await scoreCase(
      'cross-source-dedup',
      crossDedupDraft,
      [crossSourceDedupScorer, schemaValidityScorer],
      {
        metrics: {
          totalConcepts: crossDedupDraft.concepts.length,
          mergedConcepts: crossDedupDraft.concepts.filter(
            (c: Record<string, unknown>) => c.mergesWith
          ).length,
        },
      }
    )
  );
  console.error(
    `[Eval] Case 'cross-source-dedup' completed: ${results[results.length - 1].passed ? 'PASSED' : 'FAILED'} (Score: ${results[results.length - 1].score.toFixed(2)})`
  );

  // Relationship type validity (use tech source which has many relationships)
  results.push(
    await scoreCase('relationship-type-validity', techDraft, [relationshipTypeScorer], {
      metrics: { relationshipCount: techDraft.relationships.length },
    })
  );

  const report = createEvalReport({
    agent: 'ingestionAgent',
    cases: results,
    fixtureVersion:
      options.mode === 'real' ? 'ingestion-agent-real-v2' : 'ingestion-agent-fixture-v2',
    mode: options.mode,
    model: resolveModelLabel(),
    promptHash: hashText(JSON.stringify(ingestionAgentInstructions)),
    toolHash: hashToolDescriptions(
      createIngestionRetrievalTools({
        getConceptContext: async () => null,
        searchWikiConcepts: async () => [],
      })
    ),
  });

  console.error(
    `[Eval] Case 'relationship-type-validity' completed: ${results[results.length - 1].passed ? 'PASSED' : 'FAILED'} (Score: ${results[results.length - 1].score.toFixed(2)})`
  );
  console.error(`\n[Eval] === SUMMARY ===`);
  console.error(
    `[Eval] Passed: ${report.summary.passed}/${report.summary.total} | Average Score: ${(report.summary.averageScore * 100).toFixed(1)}%`
  );

  console.log(JSON.stringify(report, null, 2));
  if (options.writeReport) {
    const paths = await writeEvalReport(report);
    console.error(`Wrote eval report: ${paths.reportPath}`);
  }

  if (report.cases.some((result) => !result.passed)) {
    process.exitCode = 1;
  }
}

async function compareLatest(options: EvalCliOptions) {
  const baseline = await readEvalReport('ingestionAgent', options.baseline ?? 'latest');
  const previousMode = options.mode;
  options.mode = 'fixture';

  const [sourceA, sourceB] = await Promise.all([
    readFile(resolve(docsDir, 'source-a-economics-basics.md'), 'utf8'),
    readFile(resolve(docsDir, 'source-b-elasticity.md'), 'utf8'),
  ]);

  const [draftA, draftB] = await Promise.all([
    extractSourceWithoutDb({
      content: sourceA,
      sourceId: 'eval-source-a',
      title: 'Economics Basics',
    }),
    extractSourceWithoutDb({
      content: sourceB,
      sourceId: 'eval-source-b',
      title: 'Elasticity',
    }),
  ]);
  const existingKeys = new Set(draftA.concepts.map((c) => c.conceptKey));
  const finalDraft = mergeDraft(draftA, draftB);

  const cases: EvalCaseResult[] = [
    await scoreCase(
      'fresh-source-extraction',
      draftA,
      [schemaValidityScorer, conceptExtractionScorer, groundingScorer, confidenceRangeScorer],
      {
        groundTruth: 2,
        metrics: {
          conceptCount: draftA.concepts.length,
          relationshipCount: draftA.relationships.length,
          conceptKeys: draftA.concepts.map((c) => c.conceptKey),
        },
      }
    ),
    await scoreCase(
      'incremental-source-extraction',
      finalDraft,
      [conceptExtractionScorer, schemaValidityScorer, duplicateAvoidanceScorer],
      {
        groundTruth: existingKeys,
        metrics: {
          sourceAConceptCount: draftA.concepts.length,
          sourceBConceptCount: draftB.concepts.length,
          finalConceptCount: finalDraft.concepts.length,
          finalRelationshipCount: finalDraft.relationships.length,
        },
      }
    ),
  ];
  options.mode = previousMode;

  const current = createEvalReport({
    agent: 'ingestionAgent',
    cases,
    fixtureVersion: 'ingestion-agent-fixture-v1',
    mode: 'fixture',
    model: resolveModelLabel(),
    promptHash: hashText(JSON.stringify(ingestionAgentInstructions)),
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

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
