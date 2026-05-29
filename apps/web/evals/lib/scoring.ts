import type { EvalDimensionScores } from './types';

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
