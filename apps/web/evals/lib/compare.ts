import type { EvalReport } from './types';

export function compareReports(current: EvalReport, baseline: EvalReport) {
  const cases = current.cases.map((currentCase) => {
    const baselineCase = baseline.cases.find((item) => item.id === currentCase.id);
    return {
      id: currentCase.id,
      baselineScore: baselineCase?.score ?? null,
      currentScore: currentCase.score,
      delta: baselineCase ? currentCase.score - baselineCase.score : null,
      regressed: baselineCase ? currentCase.score < baselineCase.score : false,
      reasons: currentCase.reasons,
    };
  });

  const dimensions = Object.fromEntries(
    Object.entries(current.dimensions).map(([dimension, currentScore]) => {
      const baselineScore = baseline.dimensions[dimension];
      return [
        dimension,
        {
          baselineScore: baselineScore ?? null,
          currentScore,
          delta: baselineScore == null ? null : currentScore - baselineScore,
          regressed: baselineScore == null ? false : currentScore < baselineScore,
        },
      ];
    })
  );

  return {
    agent: current.agent,
    baselineRunId: baseline.runId,
    currentRunId: current.runId,
    cases,
    dimensions,
    promptChanged: current.promptHash !== baseline.promptHash,
    toolDescriptionsChanged: current.toolHash !== baseline.toolHash,
    summaryDelta: current.summary.averageScore - baseline.summary.averageScore,
  };
}
