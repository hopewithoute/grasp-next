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
type ExtractionMode = "llm_strict" | "llm_json" | "deterministic";

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

    async findOrCreateForProject(
      input: Pick<NewArtifact, "projectId" | "status" | "type">
    ) {
      const existingArtifact = await this.findByProjectAndType(
        input.projectId,
        input.type
      );

      if (existingArtifact) {
        return existingArtifact;
      }

      return this.create(input);
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
        "artifactId" | "content" | "extractionMode" | "revisionFeedback"
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
            extractionMode: input.extractionMode ?? "deterministic",
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

        return toArtifactVersionRecord(version);
      });
    },

    async listVersions(artifactId: string) {
      const versions = await db
        .select()
        .from(artifactVersions)
        .where(eq(artifactVersions.artifactId, artifactId))
        .orderBy(desc(artifactVersions.versionNumber));

      return versions.map(toArtifactVersionRecord);
    },
  };
}

function toArtifactVersionRecord(
  version: typeof artifactVersions.$inferSelect
) {
  return {
    ...version,
    extractionMode: toExtractionMode(version.extractionMode),
  };
}

function toExtractionMode(value: string): ExtractionMode {
  if (value === "llm_strict" || value === "llm_json") {
    return value;
  }

  return "deterministic";
}
