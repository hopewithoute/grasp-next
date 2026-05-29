import { createScorer } from '@grasp/ai/evals';

type ToolCall = { toolName: string; args?: Record<string, unknown> };

/**
 * Checks that the agent called at least one of the required tools.
 */
export const requiredToolsScorer = createScorer({
  id: 'required-tools',
  description: 'Validates that agent called all required tools',
  type: 'trajectory',
})
  .preprocess(({ run }) => {
    const trajectory = run.output as unknown as { steps?: ToolCall[] };
    const calledTools = (trajectory.steps ?? []).map((s) => s.toolName);
    const required = (run.expectedTrajectory?.steps ?? [])
      .filter((s) => s.stepType === 'tool_call')
      .map((s) => s.name);
    const missing = required.filter((t: string) => !calledTools.includes(t));
    return { calledTools, required, missing };
  })
  .analyze(({ results }) => ({
    score: results.preprocessStepResult.missing.length === 0 ? 1 : 0,
    missing: results.preprocessStepResult.missing,
  }))
  .generateScore(({ results }) => results.analyzeStepResult.score);

/**
 * Checks that the agent did NOT call any forbidden tools.
 */
export const forbiddenToolsScorer = createScorer({
  id: 'forbidden-tools',
  description: 'Validates that agent did not call forbidden tools',
  type: 'trajectory',
})
  .preprocess(({ run }) => {
    const trajectory = run.output as unknown as { steps?: ToolCall[] };
    const calledTools = (trajectory.steps ?? []).map((s) => s.toolName);
    return { calledTools };
  })
  .analyze(({ results, run }) => {
    const forbidden: string[] = run.groundTruth?.forbiddenTools ?? [];
    const violations = results.preprocessStepResult.calledTools.filter((t: string) =>
      forbidden.includes(t)
    );
    return { score: violations.length === 0 ? 1 : 0, violations };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);

/**
 * Checks that tool call ordering follows a required subsequence.
 */
export const toolOrderScorer = createScorer({
  id: 'tool-order',
  description: 'Validates that tool calls follow required ordering',
  type: 'trajectory',
})
  .preprocess(({ run }) => {
    const trajectory = run.output as unknown as { steps?: ToolCall[] };
    const calledTools = (trajectory.steps ?? []).map((s) => s.toolName);
    return { calledTools };
  })
  .analyze(({ results, run }) => {
    const required: string[] = run.groundTruth?.requiredToolOrder ?? [];
    if (required.length === 0) return { score: 1 };
    const called = results.preprocessStepResult.calledTools;
    let cursor = 0;
    for (const tool of called) {
      if (tool === required[cursor]) cursor++;
      if (cursor === required.length) break;
    }
    return { score: cursor === required.length ? 1 : 0 };
  })
  .generateScore(({ results }) => results.analyzeStepResult.score);
