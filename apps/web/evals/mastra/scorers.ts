import { createScorer } from '@grasp/ai/evals';
import { z } from 'zod/v4';

/**
 * Validates that agent output is parseable JSON matching a schema.
 */
export function createJsonSchemaScorer<T extends z.ZodTypeAny>(opts: {
  id: string;
  name?: string;
  description: string;
  schema: T;
  extractJson: (output: unknown) => unknown;
}) {
  return createScorer({
    id: opts.id,
    name: opts.name ?? opts.id,
    description: opts.description,
    type: 'agent',
  })
    .preprocess(({ run }) => {
      const raw = opts.extractJson(run.output);
      return { raw };
    })
    .analyze(({ results }) => {
      const parsed = opts.schema.safeParse(results.preprocessStepResult.raw);
      return { score: parsed.success ? 1 : 0 };
    })
    .generateScore(({ results }) => results.analyzeStepResult.score);
}

/**
 * Checks that a numeric value falls within [min, max].
 */
export function createRangeScorer(opts: {
  id: string;
  description: string;
  extractValue: (output: unknown) => number | null;
  min?: number;
  max?: number;
}) {
  return createScorer({
    id: opts.id,
    description: opts.description,
    type: 'agent',
  })
    .preprocess(({ run }) => {
      const value = opts.extractValue(run.output);
      return { value };
    })
    .analyze(({ results }) => {
      const v = results.preprocessStepResult.value;
      if (v === null) return { score: 0, reason: 'No value extracted' };
      const minOk = opts.min === undefined || v >= opts.min;
      const maxOk = opts.max === undefined || v <= opts.max;
      return { score: minOk && maxOk ? 1 : 0 };
    })
    .generateScore(({ results }) => results.analyzeStepResult.score);
}

/**
 * Boolean check scorer — wraps a predicate function into a 0/1 scorer.
 */
export function createPredicateScorer(opts: {
  id: string;
  name?: string;
  description: string;
  predicate: (output: unknown, groundTruth?: unknown) => { passed: boolean; reason?: string };
}) {
  return createScorer({
    id: opts.id,
    name: opts.name ?? opts.id,
    description: opts.description,
    type: 'agent',
  })
    .preprocess(({ run }) => {
      const result = opts.predicate(run.output, run.groundTruth);
      return result;
    })
    .analyze(({ results }) => ({
      score: results.preprocessStepResult.passed ? 1 : 0,
      reason: results.preprocessStepResult.reason,
    }))
    .generateScore(({ results }) => results.analyzeStepResult.score)
    .generateReason(({ results }) => results.analyzeStepResult.reason ?? '');
}
