import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRefinementTools, refinementAgent, refinementAgentInstructions } from '@grasp/ai/refinement';
import { canUseAgentModel } from '@grasp/ai/model-resolver';
import type { KnowledgebaseRepository } from '@grasp/domain';
import { parseEvalCliOptions } from './lib/cli';
import { compareReports } from './lib/compare';
import { createEvalReport } from './lib/eval-runner';
import {
  createFixtureRefinementTools,
  createRefinementToolOverrides,
  type RefinementToolFixture,
} from './lib/fixture-tools';
import { hashText, hashToolDescriptions } from './lib/prompt-hash';
import { readEvalReport, writeEvalReport } from './lib/report-writer';
import { check, containsSubsequence, scoreChecks } from './lib/scoring';
import { createToolRecording, wrapToolsWithRecorder, type ToolRecording } from './lib/tool-recorder';
import type { EvalCaseResult, EvalCliOptions } from './lib/types';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

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

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, 'fixtures/refinement-agent/cases.json');

async function main() {
  const options = parseEvalCliOptions();
  if (options.mode === 'compare') {
    await compareLatest(options);
    return;
  }

  if (!canUseAgentModel('refinementAgent', process.env)) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason:
            'No configured LLM credentials for refinementAgent. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_COMPATIBLE_* credentials.',
        },
        null,
        2
      )
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
    model: resolveModelLabel('refinementAgent'),
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

  return scoreCase({ finalText, recording, testCase });
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
    createRefinementTools({
      knowledgebaseRepository: repository,
      projectId: 'eval-project',
    }),
    recording
  );
}

function scoreCase({
  finalText,
  recording,
  testCase,
}: {
  finalText: string;
  recording: ToolRecording;
  testCase: RefinementEvalCase;
}): EvalCaseResult {
  const toolCalls = recording.calls.map((call) => call.toolName);
  const actions = recording.proposals.flatMap(readProposalActions);
  const checks = [];

  for (const requiredTool of testCase.expect.requiredTools ?? []) {
    checks.push(
      check(
        'toolSelection',
        toolCalls.includes(requiredTool),
        `Expected tool call ${requiredTool}.`
      )
    );
  }

  for (const forbiddenTool of testCase.expect.forbiddenTools ?? []) {
    checks.push(
      check(
        'toolSelection',
        !toolCalls.includes(forbiddenTool),
        `Unexpected tool call ${forbiddenTool}.`
      )
    );
  }

  if (testCase.expect.requiredToolOrder) {
    const allowedOrders = [
      testCase.expect.requiredToolOrder,
      ...(testCase.expect.allowedToolOrders ?? []),
    ];
    checks.push(
      check(
        'toolOrder',
        allowedOrders.some((order) => containsSubsequence(toolCalls, order)),
        `Expected one allowed tool order: ${allowedOrders
          .map((order) => order.join(' -> '))
          .join(' OR ')}.`
      )
    );
  }

  for (const forbiddenActionType of testCase.expect.forbiddenActionTypes ?? []) {
    checks.push(
      check(
        'payloadCorrectness',
        !actions.some((action) => action.type === forbiddenActionType),
        `Unexpected proposal action ${forbiddenActionType}.`
      )
    );
  }

  for (const expectedAction of testCase.expect.actions) {
    const action = findMatchingAction(actions, expectedAction);
    checks.push(
      check(
        'payloadCorrectness',
        Boolean(action),
        `Expected proposal action ${describeExpectedAction(expectedAction)}.`
      )
    );
  }

  if (testCase.expect.noOrphanRelationships) {
    const existingKeys = new Set(
      (testCase.fixture?.concepts ?? []).map((concept) => concept.conceptKey)
    );
    const addedKeys = new Set(
      actions
        .filter((action) => action.type === 'add_concept')
        .map((action) => action.payload?.conceptKey)
        .filter((value): value is string => typeof value === 'string')
    );
    const relationships = actions.filter((action) => action.type === 'add_relationship');
    checks.push(
      check(
        'payloadCorrectness',
        relationships.every((relationship) => {
          const source = relationship.payload?.sourceConceptKey;
          const target = relationship.payload?.targetConceptKey;
          return (
            typeof source === 'string' &&
            typeof target === 'string' &&
            (existingKeys.has(source) || addedKeys.has(source)) &&
            (existingKeys.has(target) || addedKeys.has(target))
          );
        }),
        'Expected every relationship endpoint to exist or be added in the same proposal.'
      )
    );
  }

  if (testCase.expect.mustNotClaimApplied) {
    checks.push(
      check(
        'policyCompliance',
        !/sudah (saya )?(tambahkan|hapus|update|ubah|hubungkan|diproses|diterapkan)|has been (added|deleted|updated|applied)/i.test(
          finalText
        ),
        'Final answer claimed a graph mutation was already applied.'
      )
    );
  }

  const proposalCount = recording.proposals.length;
  if ((testCase.expect.actions.length > 0 || testCase.expect.requiredTools?.includes('propose-graph-changes')) && proposalCount > 0) {
    checks.push(check('policyCompliance', proposalCount === 1, 'Expected exactly one graph proposal.'));
  }

  return scoreChecks({
    id: testCase.id,
    checks,
    metrics: {
      finalText,
      proposalCount,
      proposals: recording.proposals,
      toolCalls,
    },
  });
}

function readProposalActions(proposal: unknown): Array<{ payload?: Record<string, unknown>; type?: string }> {
  if (!proposal || typeof proposal !== 'object') {
    return [];
  }

  const actions = (proposal as { actions?: unknown }).actions;
  return Array.isArray(actions) ? actions : [];
}

function findMatchingAction(
  actions: Array<{ payload?: Record<string, unknown>; type?: string }>,
  expected: ExpectedAction
) {
  return actions.find((action) => {
    if (action.type !== expected.type) {
      return false;
    }

    const payload = action.payload ?? {};
    if (expected.conceptKey && payload.conceptKey !== expected.conceptKey) {
      return false;
    }
    if (expected.sourceConceptKey && payload.sourceConceptKey !== expected.sourceConceptKey) {
      return false;
    }
    if (expected.targetConceptKey && payload.targetConceptKey !== expected.targetConceptKey) {
      return false;
    }
    if (expected.relationshipType && payload.relationshipType !== expected.relationshipType) {
      return false;
    }
    if (
      expected.evidenceTextIncludes &&
      (typeof payload.evidenceText !== 'string' ||
        !payload.evidenceText.toLowerCase().includes(expected.evidenceTextIncludes.toLowerCase()))
    ) {
      return false;
    }

    return true;
  });
}

function describeExpectedAction(expected: ExpectedAction) {
  return [
    expected.type,
    expected.conceptKey,
    expected.sourceConceptKey,
    expected.targetConceptKey,
    expected.relationshipType,
    expected.evidenceTextIncludes,
  ]
    .filter(Boolean)
    .join(':');
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
    model: resolveModelLabel('refinementAgent'),
    promptHash: hashText(refinementAgentInstructions),
    toolHash: hashToolDescriptions(createFixtureRefinementTools()),
  });

  const comparison = compareReports(current, baseline);
  console.log(JSON.stringify(comparison, null, 2));

  if (comparison.cases.some((item) => item.regressed)) {
    process.exitCode = 1;
  }
}

function resolveModelLabel(agent: 'refinementAgent') {
  return (
    process.env.REFINEMENT_AGENT_MODEL ??
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
