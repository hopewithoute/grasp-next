import { and, desc, eq, max } from "drizzle-orm";
import type { DbClient } from "./client";
import {
  artifacts,
  artifactVersions,
  type Artifact,
  type NewArtifact,
  type NewArtifactVersion,
} from "./schema";

export type ArtifactRepository = ReturnType<typeof createArtifactRepository>;

export function createArtifactRepository(db: DbClient) {
  return {
    async create(
      input: Pick<NewArtifact, "projectId" | "status" | "type">
    ) {
      const [artifact] = await db.insert(artifacts).values(input).returning();

      return artifact;
    },

    async findById(artifactId: string) {
      const [artifact] = await db
        .select()
        .from(artifacts)
        .where(eq(artifacts.id, artifactId))
        .limit(1);

      return artifact ?? null;
    },

    async findByProjectAndType(
      projectId: string,
      type: Artifact["type"]
    ) {
      const [artifact] = await db
        .select()
        .from(artifacts)
        .where(and(eq(artifacts.projectId, projectId), eq(artifacts.type, type)))
        .limit(1);

      return artifact ?? null;
    },

    async updateStatus(artifactId: string, status: Artifact["status"]) {
      const [artifact] = await db
        .update(artifacts)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(artifacts.id, artifactId))
        .returning();

      return artifact ?? null;
    },

    async createVersion(
      input: Pick<
        NewArtifactVersion,
        "artifactId" | "content" | "revisionFeedback"
      >
    ) {
      return db.transaction(async (tx) => {
        const [{ nextVersionNumber }] = await tx
          .select({
            nextVersionNumber: max(artifactVersions.versionNumber),
          })
          .from(artifactVersions)
          .where(eq(artifactVersions.artifactId, input.artifactId));

        const [version] = await tx
          .insert(artifactVersions)
          .values({
            artifactId: input.artifactId,
            content: input.content,
            revisionFeedback: input.revisionFeedback,
            versionNumber: (nextVersionNumber ?? 0) + 1,
          })
          .returning();

        await tx
          .update(artifacts)
          .set({
            currentVersionId: version.id,
            updatedAt: new Date(),
          })
          .where(eq(artifacts.id, input.artifactId));

        return version;
      });
    },

    async listVersions(artifactId: string) {
      return db
        .select()
        .from(artifactVersions)
        .where(eq(artifactVersions.artifactId, artifactId))
        .orderBy(desc(artifactVersions.versionNumber));
    },
  };
}
