import { desc, eq } from 'drizzle-orm';
import { INGESTION_RUN_STATUS, type IngestionRunRepository } from '@grasp/domain';
import type { DbClient } from './client';
import { ingestionRuns } from './schema';

export type DbIngestionRunRepository = ReturnType<typeof createIngestionRunRepository>;

export function createIngestionRunRepository(db: DbClient): IngestionRunRepository {
  return {
    async create(input) {
      const [run] = await db
        .insert(ingestionRuns)
        .values({
          metadata: input.metadata ?? null,
          projectId: input.projectId,
          sourceId: input.sourceId ?? null,
          status: INGESTION_RUN_STATUS.INGESTING,
        })
        .returning();

      return run;
    },

    async findLatestByProject(projectId) {
      const [run] = await db
        .select()
        .from(ingestionRuns)
        .where(eq(ingestionRuns.projectId, projectId))
        .orderBy(desc(ingestionRuns.createdAt))
        .limit(1);

      return run ?? null;
    },

    async markCompleted(ingestionRunId, metadata) {
      const [run] = await db
        .update(ingestionRuns)
        .set({
          completedAt: new Date(),
          metadata: metadata ?? null,
          status: INGESTION_RUN_STATUS.COMPLETED,
          updatedAt: new Date(),
        })
        .where(eq(ingestionRuns.id, ingestionRunId))
        .returning();

      return run ?? null;
    },

    async markFailed(ingestionRunId, failureReason, metadata) {
      const [run] = await db
        .update(ingestionRuns)
        .set({
          completedAt: new Date(),
          failureReason,
          metadata: metadata ?? null,
          status: INGESTION_RUN_STATUS.FAILED,
          updatedAt: new Date(),
        })
        .where(eq(ingestionRuns.id, ingestionRunId))
        .returning();

      return run ?? null;
    },
  };
}
