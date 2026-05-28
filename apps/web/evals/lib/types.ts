export type EvalMode = 'fixture' | 'real' | 'compare';

export type EvalCliOptions = {
  baseline?: string;
  mode: EvalMode;
  report?: string;
  writeReport: boolean;
};

export type EvalDimensionScores = Record<string, number>;

export type EvalCaseResult = {
  id: string;
  passed: boolean;
  score: number;
  dimensions: EvalDimensionScores;
  reasons: string[];
  metrics: Record<string, unknown>;
};

export type EvalReport = {
  agent: string;
  cases: EvalCaseResult[];
  dimensions: EvalDimensionScores;
  fixtureVersion: string;
  mode: Exclude<EvalMode, 'compare'>;
  model: string;
  promptHash: string;
  runId: string;
  summary: {
    averageScore: number;
    passed: number;
    total: number;
  };
  timestamp: string;
  toolHash: string;
};
