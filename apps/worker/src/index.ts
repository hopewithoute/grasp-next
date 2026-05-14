import "./load-env.js";

import { extractConceptGraph } from "@grasp/ai";
import {
  createArtifactRepository,
  createAuditLogRepository,
  createConceptRepository,
  createDbClient,
  createProjectRepository,
} from "@grasp/db";
import { Worker } from "bullmq";
import { parseRedisConnection, type ConceptExtractionJob } from "./concept-extraction-queue.js";
import { createQueueConfig } from "./queue-config.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const queueConfig = createQueueConfig(process.env);
const db = createDbClient(databaseUrl);
const artifactRepository = createArtifactRepository(db);
const auditLogRepository = createAuditLogRepository(db);
const conceptRepository = createConceptRepository(db);
const projectRepository = createProjectRepository(db);

const worker = new Worker<ConceptExtractionJob>(
  "concept-extraction",
  async (job) => {
    const project = await projectRepository.findById(job.data.projectId);

    if (!project) {
      throw new Error(`Project not found: ${job.data.projectId}`);
    }

    try {
      if (!project.sourceMaterial?.trim()) {
        throw new Error("missing_source_material");
      }

      const extractedGraph = await extractConceptGraph({
        sourceMaterial: project.sourceMaterial,
      });
      const artifact = await artifactRepository.findOrCreateForProject({
        projectId: project.id,
        status: "generating",
        type: "concept_graph",
      });
      const artifactVersion = await artifactRepository.createVersion({
        artifactId: artifact.id,
        content: extractedGraph,
        revisionFeedback: null,
      });

      await conceptRepository.replaceForProject(project.id, {
        concepts: extractedGraph.concepts.map((concept) => ({
          ...concept,
          confidence: concept.confidence.toFixed(2),
        })),
        relationships: extractedGraph.relationships,
      });
      await artifactRepository.updateStatus(artifact.id, "generated");
      const updatedProject = await projectRepository.updateStatus(project.id, "processed");

      await auditLogRepository.write({
        actorId: project.ownerId,
        action: "project.concept_extraction.completed",
        entityType: "project",
        entityId: project.id,
        metadata: {
          artifactId: artifact.id,
          artifactVersionId: artifactVersion.id,
          conceptCount: extractedGraph.concepts.length,
          relationshipCount: extractedGraph.relationships.length,
          status: updatedProject?.status ?? "processed",
        },
      });
    } catch (error) {
      await projectRepository.updateStatus(project.id, "failed");
      await auditLogRepository.write({
        actorId: project.ownerId,
        action: "project.concept_extraction.failed",
        entityType: "project",
        entityId: project.id,
        metadata: {
          reason: getErrorMessage(error),
        },
      });

      throw error;
    }
  },
  {
    connection: parseRedisConnection(queueConfig.redisUrl),
    prefix: queueConfig.prefix,
  }
);

worker.on("failed", async (job, error) => {
  console.error("Concept extraction job failed.", {
    error,
    jobId: job?.id,
    projectId: job?.data.projectId,
  });
});

console.log(
  `Grasp worker listening for concept extraction jobs with queue prefix "${queueConfig.prefix}".`
);

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "unknown_error";
}
