import { createScorer } from '@grasp/ai/evals';

type IngestionOutput = {
  concepts: Array<{
    conceptKey: string;
    confidence?: number;
    sourceRefs?: Array<{ blockId?: string; quote?: string; locationLabel?: string }>;
  }>;
  relationships: unknown[];
};

/**
 * Checks that extraction produced at least `min` concepts.
 */
export const conceptCountScorer = createScorer({
  id: 'concept-count',
  description: 'Validates that extraction produced a minimum number of concepts',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionOutput;
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

/**
 * Checks that every concept sourceRef has blockId, quote, and locationLabel.
 */
export const groundingScorer = createScorer({
  id: 'grounding',
  description: 'Validates that concept sourceRefs include blockId, quote, and locationLabel',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionOutput;
    const concepts = output.concepts ?? [];
    const allGrounded = concepts.every((c) =>
      (c.sourceRefs ?? []).every((ref) => ref.blockId && ref.quote && ref.locationLabel)
    );
    return { allGrounded, conceptCount: concepts.length };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.allGrounded ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

/**
 * Checks that confidence scores are within [0, 1].
 */
export const confidenceRangeScorer = createScorer({
  id: 'confidence-range',
  description: 'Validates that concept confidence scores are within 0..1',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionOutput;
    const concepts = output.concepts ?? [];
    const allValid = concepts.every((c) => {
      if (c.confidence === undefined) return true;
      return c.confidence >= 0 && c.confidence <= 1;
    });
    return { allValid };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.allValid ? 1 : 0,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

/**
 * Checks that the merged extraction avoids excessive duplicates.
 */
export const duplicateAvoidanceScorer = createScorer({
  id: 'duplicate-avoidance',
  description: 'Validates that incremental merge avoids excessive concept duplication',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const output = run.output as unknown as IngestionOutput;
    const concepts = output.concepts ?? [];
    const uniqueKeys = new Set(concepts.map((c) => c.conceptKey));
    return {
      total: concepts.length,
      unique: uniqueKeys.size,
      duplicateRatio: concepts.length > 0 ? 1 - uniqueKeys.size / concepts.length : 0,
    };
  })
  .analyze(({ results }) => {
    const { duplicateRatio } = results.preprocessStepResult;
    return { score: duplicateRatio <= 0.5 ? 1 : 0, duplicateRatio };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);
