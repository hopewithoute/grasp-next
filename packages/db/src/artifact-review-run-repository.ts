import { eq } from 'drizzle-orm';
import { ARTIFACT_REVIEW_RUN_STATUS } from '@grasp/domain';
import type { DbClient } from './client';
import { artifactReviewRuns, type ArtifactReviewRun, type NewArtifactReviewRun } from './schema';

export type ArtifactReviewRunRepository = ReturnType<typeof createArtifactReviewRunRepository>;

export function createArtifactReviewRunRepository(db: DbClient) {
  return {
    async createSuspended(
      input: Pick<
        NewArtifactReviewRun,
        | 'artifactId'
        | 'artifactVersionId'
        | 'resumeLabel'
        | 'resumeLabels'
        | 'suspendedSteps'
        | 'workflowId'
        | 'workflowRunId'
      >
    ) {
      const [reviewRun] = await db
        .insert(artifactReviewRuns)
        .values({
          ...input,
          status: ARTIFACT_REVIEW_RUN_STATUS.SUSPENDED,
        })
        .returning();

      return reviewRun;
    },

    async findByArtifactVersionId(artifactVersionId: string) {
      const [reviewRun] = await db
        .select()
        .from(artifactReviewRuns)
        .where(eq(artifactReviewRuns.artifactVersionId, artifactVersionId))
        .limit(1);

      return reviewRun ?? null;
    },

    async updateStatus(reviewRunId: string, status: ArtifactReviewRun['status']) {
      const [reviewRun] = await db
        .update(artifactReviewRuns)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(artifactReviewRuns.id, reviewRunId))
        .returning();

      return reviewRun ?? null;
    },
  };
}
