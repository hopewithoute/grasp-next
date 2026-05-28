import { randomUUID } from 'node:crypto';
import { averageDimensions } from './scoring';
import type { EvalCaseResult, EvalReport } from './types';

export function createEvalReport({
  agent,
  cases,
  fixtureVersion,
  mode,
  model,
  promptHash,
  toolHash,
}: {
  agent: string;
  cases: EvalCaseResult[];
  fixtureVersion: string;
  mode: EvalReport['mode'];
  model: string;
  promptHash: string;
  toolHash: string;
}): EvalReport {
  const passed = cases.filter((result) => result.passed).length;
  const averageScore =
    cases.reduce((total, result) => total + result.score, 0) / Math.max(cases.length, 1);

  return {
    agent,
    cases,
    dimensions: averageDimensions(cases),
    fixtureVersion,
    mode,
    model,
    promptHash,
    runId: randomUUID(),
    summary: {
      averageScore,
      passed,
      total: cases.length,
    },
    timestamp: new Date().toISOString(),
    toolHash,
  };
}
