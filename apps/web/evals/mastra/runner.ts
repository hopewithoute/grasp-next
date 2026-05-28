import type { MastraScorer } from '@grasp/ai/evals';

type ScorerResult = {
  score: number;
  reason?: string;
  [key: string]: unknown;
};

type CaseResult = {
  id: string;
  scores: Record<string, ScorerResult>;
  aggregateScore: number;
  passed: boolean;
  metrics: Record<string, unknown>;
};

/**
 * Runs a set of Mastra scorers against an output value and collects results.
 * Useful for pipeline tests that don't use runEvals directly.
 */
export async function runScorers(
  scorers: MastraScorer<any, any, any, any>[],
  opts: {
    input?: unknown;
    output: unknown;
    groundTruth?: unknown;
  }
): Promise<CaseResult> {
  const scores: Record<string, ScorerResult> = {};

  for (const scorer of scorers) {
    const result = await scorer.run({
      input: opts.input,
      output: opts.output,
      groundTruth: opts.groundTruth,
    } as any);
    const scorerResult = result as { score?: unknown; reason?: unknown };
    scores[scorer.id] = {
      ...result,
      score: typeof scorerResult.score === 'number' ? scorerResult.score : 0,
      reason: typeof scorerResult.reason === 'string' ? scorerResult.reason : undefined,
    };
  }

  const scoreValues = Object.values(scores).map((s) => s.score);
  const aggregateScore =
    scoreValues.length === 0 ? 1 : scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;

  return {
    id: '',
    scores,
    aggregateScore,
    passed: aggregateScore === 1,
    metrics: {},
  };
}

/**
 * Wraps a pipeline function with Mastra scorer evaluation.
 * Runs the pipeline, then evaluates output with scorers.
 */
export async function evaluatePipeline<TOutput>(
  id: string,
  pipelineFn: () => Promise<TOutput>,
  scorers: MastraScorer<any, any, any, any>[],
  opts: {
    input?: unknown;
    groundTruth?: unknown;
    metrics?: Record<string, unknown>;
  } = {}
): Promise<CaseResult> {
  const output = await pipelineFn();
  const result = await runScorers(scorers, {
    input: opts.input,
    output,
    groundTruth: opts.groundTruth,
  });

  return {
    ...result,
    id,
    metrics: opts.metrics ?? {},
  };
}
