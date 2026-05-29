import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type RunEvalsDataItem = {
  input: unknown;
  groundTruth?: unknown;
  expectedTrajectory?: unknown;
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(currentDir, '../fixtures');

/**
 * Loads a fixture JSON file and returns the cases array.
 */
export async function loadFixture<T = unknown>(relativePath: string): Promise<T> {
  const fullPath = join(fixturesDir, relativePath);
  return JSON.parse(await readFile(fullPath, 'utf8')) as T;
}

/**
 * Maps ingestion source content into a runEvals data item.
 */
export function ingestionSourceToDataItem(opts: {
  content: string;
  sourceId: string;
  title: string;
  minConcepts?: number;
}): RunEvalsDataItem {
  return {
    input: { content: opts.content, sourceId: opts.sourceId, title: opts.title },
    groundTruth: opts.minConcepts ?? 2,
  };
}

/**
 * Maps refinement fixture cases into runEvals data items.
 */
export function refinementCaseToDataItem(testCase: {
  id: string;
  messages: Array<{ role: string; content: string }>;
  expect: {
    requiredTools?: string[];
    requiredToolOrder?: string[];
    forbiddenTools?: string[];
  };
}): RunEvalsDataItem {
  return {
    input: testCase.messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
    groundTruth: {
      requiredTools: testCase.expect.requiredTools,
      requiredToolOrder: testCase.expect.requiredToolOrder,
      forbiddenTools: testCase.expect.forbiddenTools,
    },
    expectedTrajectory: testCase.expect.requiredTools
      ? {
          steps: testCase.expect.requiredTools.map((name) => ({
            stepType: 'tool_call' as const,
            name,
          })),
        }
      : undefined,
  };
}
