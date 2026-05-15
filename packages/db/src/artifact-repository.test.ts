import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { createArtifactRepository } from "./artifact-repository";
import { createProjectRepository } from "./project-repository";
import * as schema from "./schema";
import { projects, user } from "./schema";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase("createArtifactRepository", () => {
  if (!databaseUrl) {
    return;
  }

  const sql = postgres(databaseUrl);
  const db = drizzle(sql, { schema });
  const artifactRepository = createArtifactRepository(db);
  const projectRepository = createProjectRepository(db);
  const ownerId = `artifact-repository-test-${randomUUID()}`;

  before(async () => {
    await db.insert(user).values({
      createdAt: new Date(),
      email: `${ownerId}@example.test`,
      emailVerified: true,
      id: ownerId,
      name: "Artifact Repository Test",
      updatedAt: new Date(),
    });
  });

  after(async () => {
    await db.delete(user).where(eq(user.id, ownerId));
    await sql.end();
  });

  it("creates sequential artifact versions and stores revision feedback on the latest version", async () => {
    const project = await projectRepository.create({
      description: "Repository integration test",
      ownerId,
      sourceMaterial: "Atoms form molecules.",
      title: "Artifact repository test",
    });

    try {
      const artifact = await artifactRepository.create({
        projectId: project.id,
        status: "generating",
        type: "concept_graph",
      });
      const versionOne = await artifactRepository.createVersion({
        artifactId: artifact.id,
        content: {
          concepts: ["Atom"],
        },
        extractionMode: "llm_strict",
        revisionFeedback: null,
      });
      const versionTwo = await artifactRepository.createVersion({
        artifactId: artifact.id,
        content: {
          concepts: ["Atom", "Molecule"],
        },
        extractionMode: "deterministic",
        revisionFeedback: "Split atom and molecule concepts.",
      });
      const versions = await artifactRepository.listVersions(artifact.id);
      const updatedArtifact = await artifactRepository.findById(artifact.id);

      assert.equal(versionOne.versionNumber, 1);
      assert.equal(versionOne.revisionFeedback, null);
      assert.equal(versionOne.extractionMode, "llm_strict");
      assert.equal(versionTwo.versionNumber, 2);
      assert.equal(
        versionTwo.revisionFeedback,
        "Split atom and molecule concepts."
      );
      assert.equal(versionTwo.extractionMode, "deterministic");
      assert.equal(versions.length, 2);
      assert.equal(versions[0]?.id, versionTwo.id);
      assert.equal(versions[1]?.id, versionOne.id);
      assert.equal(updatedArtifact?.currentVersionId, versionTwo.id);
    } finally {
      await db.delete(projects).where(eq(projects.id, project.id));
    }
  });
});
