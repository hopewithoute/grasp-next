import type { IngestionRunStatus } from '../constants';

export type IngestionRunRecord = {
  completedAt: Date | null;
  createdAt: Date;
  failureReason: string | null;
  id: string;
  metadata: unknown;
  projectId: string;
  sourceId: string | null;
  startedAt: Date;
  status: IngestionRunStatus;
  updatedAt: Date;
};

export type IngestionRunRepository = {
  create(input: {
    metadata?: unknown;
    projectId: string;
    sourceId?: string | null;
  }): Promise<IngestionRunRecord>;
  findLatestByProject(projectId: string): Promise<IngestionRunRecord | null>;
  markCompleted(ingestionRunId: string, metadata?: unknown): Promise<IngestionRunRecord | null>;
  markFailed(
    ingestionRunId: string,
    failureReason: string,
    metadata?: unknown
  ): Promise<IngestionRunRecord | null>;
};
