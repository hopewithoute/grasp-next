import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRefinementTools, refinementAgent, refinementAgentInstructions } from '@grasp/ai/refinement';
import { canUseAgentModel } from '@grasp/ai/model-resolver';
import type { KnowledgebaseRepository } from '@grasp/domain';
import { createScorer } from '@grasp/ai/evals';
import { parseEvalCliOptions } from '../lib/cli';
import { compareReports } from '../lib/compare';
import { createEvalReport } from '../lib/eval-runner';
import {
  createFixtureRefinementTools,
  createRefinementToolOverrides,
  type RefinementToolFixture,
} from '../lib/fixture-tools';
import { hashText, hashToolDescriptions } from '../lib/prompt-hash';
import { readEvalReport, writeEvalReport } from '../lib/report-writer';
import { containsSubsequence } from '../lib/scoring';
import { createToolRecording, wrapToolsWithRecorder, type ToolRecording } from '../lib/tool-recorder';
import type { EvalCaseResult, EvalCliOptions } from '../lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

type RefinementEvalCase = {
  id: string;
  messages: ChatMessage[];
  fixture?: RefinementToolFixture;
  expect: {
    actions: ExpectedAction[];
    forbiddenActionTypes?: string[];
    forbiddenTools?: string[];
    mustNotClaimApplied?: boolean;
    noOrphanRelationships?: boolean;
    allowedToolOrders?: string[][];
    requiredToolOrder?: string[];
    requiredTools?: string[];
  };
};

type RefinementEvalFixture = {
  cases: RefinementEvalCase[];
  fixtureVersion: string;
};

type ExpectedAction = {
  conceptKey?: string;
  evidenceTextIncludes?: string;
  relationshipType?: string;
  sourceConceptKey?: string;
  targetConceptKey?: string;
  type: string;
};

type RefinementScoredOutput = {
  finalText: string;
  toolCalls: string[];
  proposals: unknown[];
  actions: Array<{ payload?: Record<string, unknown>; type?: string }>;
  expected: RefinementEvalCase['expect'];
  fixtureConcepts?: RefinementToolFixture['concepts'];
};

// ─── Scorers ─────────────────────────────────────────────────────────────────

const requiredToolsScorer = createScorer({
  id: 'required-tools',
  description: 'Validates that agent called all required tools',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as RefinementScoredOutput;
    const required = output.expected.requiredTools ?? [];
    const missing = required.filter((t) => !output.toolCalls.includes(t));
    return { required, missing, toolCalls: output.toolCalls };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.missing.length === 0 ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

const forbiddenToolsScorer = createScorer({
  id: 'forbidden-tools',
  description: 'Validates that agent did not call forbidden tools',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as RefinementScoredOutput;
    const forbidden = output.expected.forbiddenTools ?? [];
    const violations = output.toolCalls.filter((t) => forbidden.includes(t));
    return { violations, forbidden };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.violations.length === 0 ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

const toolOrderScorer = createScorer({
  id: 'tool-order',
  description: 'Validates tool calls follow required ordering',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as RefinementScoredOutput;
    const required = output.expected.requiredToolOrder;
    const allowedOrders = required
      ? [required, ...(output.expected.allowedToolOrders ?? [])]
      : [];
    const ordered =
      allowedOrders.length === 0 ||
      allowedOrders.some((order) => containsSubsequence(output.toolCalls, order));
    return { ordered, allowedOrders };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.ordered ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

const actionPresenceScorer = createScorer({
  id: 'action-presence',
  description: 'Validates that expected proposal actions were found',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as RefinementScoredOutput;
    const expectedActions = output.expected.actions ?? [];
    const found = expectedActions.filter((expected) =>
      output.actions.some((action) => matchesAction(action, expected))
    );
    return { total: expectedActions.length, found: found.length };
  })
  .analyze(({ results }) => {
    const { total, found } = results.preprocessStepResult;
    return { score: total === 0 || found === total ? 1 : found / total };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);

const orphanRelationshipsScorer = createScorer({
  id: 'no-orphan-relationships',
  description: 'Validates relationship endpoints exist or are added in same proposal',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as RefinementScoredOutput;
    if (!output.expected.noOrphanRelationships) return { applicable: false, valid: true };

    const existingKeys = new Set(
      (output.fixtureConcepts ?? []).map((c) => c.conceptKey)
    );
    const addedKeys = new Set(
      output.actions
        .filter((a) => a.type === 'add_concept')
        .map((a) => a.payload?.conceptKey)
        .filter((v): v is string => typeof v === 'string')
    );
    const relationships = output.actions.filter((a) => a.type === 'add_relationship');
    const allValid = relationships.every((rel) => {
      const src = rel.payload?.sourceConceptKey;
      const tgt = rel.payload?.targetConceptKey;
      return (
        typeof src === 'string' &&
        typeof tgt === 'string' &&
        (existingKeys.has(src) || addedKeys.has(src)) &&
        (existingKeys.has(tgt) || addedKeys.has(tgt))
      );
    });

    return { applicable: true, valid: allValid };
  })
  .analyze(({ results }) => {
    if (!results.preprocessStepResult.applicable) return { score: 1 };
    return { score: results.preprocessStepResult.valid ? 1 : 0 };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);

const policyComplianceScorer = createScorer({
  id: 'policy-compliance',
  description: 'Validates agent did not claim a mutation was already applied, and exactly one proposal if expected',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as RefinementScoredOutput;

    // Must not claim applied
    let claimedApplied = false;
    if (output.expected.mustNotClaimApplied) {
      claimedApplied =
        /sudah (saya )?(tambahkan|hapus|update|ubah|hubungkan|diproses|diterapkan)|has been (added|deleted|updated|applied)/i.test(
          output.finalText
        );
    }

    // Exactly one proposal when actions expected
    let singleProposal = true;
    if (
      (output.expected.actions.length > 0 || output.expected.requiredTools?.includes('propose-graph-changes')) &&
      output.proposals.length > 0
    ) {
      singleProposal = output.proposals.length === 1;
    }

    return { claimedApplied, singleProposal };
  })
  .analyze(({ results }) => {
    const { claimedApplied, singleProposal } = results.preprocessStepResult;
    return { score: !claimedApplied && singleProposal ? 1 : 0 };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);



// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchesAction(
  action: { payload?: Record<string, unknown>; type?: string },
  expected: ExpectedAction
): boolean {
  if (action.type !== expected.type) return false;
  const p = action.payload ?? {};
  if (expected.conceptKey && p.conceptKey !== expected.conceptKey) return false;
  if (expected.sourceConceptKey && p.sourceConceptKey !== expected.sourceConceptKey) return false;
  if (expected.targetConceptKey && p.targetConceptKey !== expected.targetConceptKey) return false;
  if (expected.relationshipType && p.relationshipType !== expected.relationshipType) return false;
  if (
    expected.evidenceTextIncludes &&
    (typeof p.evidenceText !== 'string' ||
      !p.evidenceText.toLowerCase().includes(expected.evidenceTextIncludes.toLowerCase()))
  )
    return false;
  return true;
}

function readProposalActions(proposal: unknown): Array<{ payload?: Record<string, unknown>; type?: string }> {
  if (!proposal || typeof proposal !== 'object') return [];
  const actions = (proposal as { actions?: unknown }).actions;
  return Array.isArray(actions) ? actions : [];
}

const allScorers = [
  requiredToolsScorer,
  forbiddenToolsScorer,
  toolOrderScorer,
  actionPresenceScorer,
  orphanRelationshipsScorer,
  policyComplianceScorer,
];

// ─── Pipeline ────────────────────────────────────────────────────────────────

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, '../fixtures/refinement-agent/cases.json');

async function scoreCase(output: RefinementScoredOutput): Promise<EvalCaseResult> {
  const dimensions: Record<string, number> = {};
  const reasons: string[] = [];

  // Custom scorers
  for (const scorer of allScorers) {
    const result = await scorer.run({ output } as any);
    const scorerResult = result as { score?: unknown; reason?: unknown };
    if (typeof scorerResult.score === 'number') {
      dimensions[scorer.id] = scorerResult.score;
    }
    if (scorerResult.reason) {
      reasons.push(String(scorerResult.reason));
    }
  }

  const values = Object.values(dimensions);
  const score = values.length === 0 ? 1 : values.reduce((a, b) => a + b, 0) / values.length;

  return {
    id: '',
    passed: score === 1,
    score,
    dimensions,
    reasons,
    metrics: {
      finalText: output.finalText,
      proposalCount: output.proposals.length,
      proposals: output.proposals,
      toolCalls: output.toolCalls,
    },
  };
}

function createToolsForMode(
  fixture: RefinementToolFixture | undefined,
  mode: EvalCliOptions['mode'],
  recording: ToolRecording
) {
  if (mode === 'fixture') {
    const tools = createFixtureRefinementTools(fixture);
    return wrapToolsWithRecorder(tools, recording, createRefinementToolOverrides(fixture));
  }

  const repository = {
    searchConceptsForIngestion: async () =>
      (fixture?.concepts ?? []).map((concept) => ({
        confidence: concept.confidence ?? 1,
        difficulty: concept.difficulty ?? 'beginner',
        evidenceCount: concept.evidenceCount ?? 0,
        ...concept,
      })),
  } as unknown as KnowledgebaseRepository;

  return wrapToolsWithRecorder(
    createRefinementTools({ knowledgebaseRepository: repository, projectId: 'eval-project' }),
    recording
  );
}

async function runCase(
  testCase: RefinementEvalCase,
  options: EvalCliOptions
): Promise<EvalCaseResult> {
  const recording = createToolRecording();
  const tools = createToolsForMode(testCase.fixture, options.mode, recording);
  const result = await refinementAgent.stream(testCase.messages, {
    toolsets: { refinement: tools },
    maxSteps: 10,
  });

  let finalText = '';
  for await (const chunk of result.textStream) {
    finalText += chunk;
  }

  const toolCalls = recording.calls.map((call) => call.toolName);
  const actions = recording.proposals.flatMap(readProposalActions);

  const scoredOutput: RefinementScoredOutput = {
    finalText,
    toolCalls,
    proposals: recording.proposals,
    actions,
    expected: testCase.expect,
    fixtureConcepts: testCase.fixture?.concepts,
  };

  const evalResult = await scoreCase(scoredOutput);
  evalResult.id = testCase.id;
  return evalResult;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const options = parseEvalCliOptions();
  if (options.mode === 'compare') {
    await compareLatest(options);
    return;
  }

  if (!canUseAgentModel('refinementAgent', process.env)) {
    console.log(
      JSON.stringify({
        skipped: true,
        reason:
          'No configured LLM credentials for refinementAgent. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_COMPATIBLE_* credentials.',
      })
    );
    return;
  }

  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as RefinementEvalFixture;
  const cases: EvalCaseResult[] = [];
  for (const testCase of fixture.cases) {
    cases.push(await runCase(testCase, options));
  }

  const report = createEvalReport({
    agent: 'refinementAgent',
    cases,
    fixtureVersion: fixture.fixtureVersion,
    mode: options.mode,
    model: resolveModelLabel(),
    promptHash: hashText(refinementAgentInstructions),
    toolHash: hashToolDescriptions(createFixtureRefinementTools()),
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

async function compareLatest(options: EvalCliOptions) {
  const baseline = await readEvalReport('refinementAgent', options.baseline ?? 'latest');
  const previousMode = options.mode;
  options.mode = 'fixture';
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as RefinementEvalFixture;
  const cases: EvalCaseResult[] = [];
  for (const testCase of fixture.cases) {
    cases.push(await runCase(testCase, options));
  }
  options.mode = previousMode;

  const current = createEvalReport({
    agent: 'refinementAgent',
    cases,
    fixtureVersion: fixture.fixtureVersion,
    mode: 'fixture',
    model: resolveModelLabel(),
    promptHash: hashText(refinementAgentInstructions),
    toolHash: hashToolDescriptions(createFixtureRefinementTools()),
  });

  const comparison = compareReports(current, baseline);
  console.log(JSON.stringify(comparison, null, 2));

  if (comparison.cases.some((item: any) => item.regressed)) {
    process.exitCode = 1;
  }
}

function resolveModelLabel() {
  return (
    process.env.REFINEMENT_AGENT_MODEL ??
    process.env.AI_MODEL ??
    process.env.OPENAI_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    process.env.OPENAI_COMPATIBLE_MODEL ??
    'refinementAgent:default'
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
