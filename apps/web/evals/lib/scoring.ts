import type { EvalCaseResult, EvalDimensionScores } from './types';

type Check = {
  dimension: string;
  passed: boolean;
  reason: string;
};

export function scoreChecks({
  id,
  checks,
  metrics = {},
}: {
  id: string;
  checks: Check[];
  metrics?: Record<string, unknown>;
}): EvalCaseResult {
  const reasons = checks.filter((check) => !check.passed).map((check) => check.reason);
  const dimensions = summarizeDimensions(checks);
  const passedChecks = checks.filter((check) => check.passed).length;
  const score = checks.length === 0 ? 1 : passedChecks / checks.length;

  return {
    id,
    passed: reasons.length === 0,
    score,
    dimensions,
    reasons,
    metrics,
  };
}

export function check(
  dimension: string,
  passed: boolean,
  reason: string
): Check {
  return { dimension, passed, reason };
}

export function averageDimensions(results: Array<{ dimensions: EvalDimensionScores }>) {
  const totals = new Map<string, { count: number; score: number }>();

  for (const result of results) {
    for (const [dimension, score] of Object.entries(result.dimensions)) {
      const total = totals.get(dimension) ?? { count: 0, score: 0 };
      total.count += 1;
      total.score += score;
      totals.set(dimension, total);
    }
  }

  return Object.fromEntries(
    Array.from(totals.entries()).map(([dimension, total]) => [
      dimension,
      total.count === 0 ? 1 : total.score / total.count,
    ])
  );
}

export function containsSubsequence(values: string[], expected: string[]) {
  let cursor = 0;
  for (const value of values) {
    if (value === expected[cursor]) {
      cursor += 1;
    }
    if (cursor === expected.length) {
      return true;
    }
  }

  return expected.length === 0;
}

function summarizeDimensions(checks: Check[]): EvalDimensionScores {
  const totals = new Map<string, { count: number; passed: number }>();

  for (const item of checks) {
    const total = totals.get(item.dimension) ?? { count: 0, passed: 0 };
    total.count += 1;
    total.passed += item.passed ? 1 : 0;
    totals.set(item.dimension, total);
  }

  return Object.fromEntries(
    Array.from(totals.entries()).map(([dimension, total]) => [
      dimension,
      total.count === 0 ? 1 : total.passed / total.count,
    ])
  );
}
