import "./load-env.js";

import {
  mastra,
  type ReviewConceptsSuspendDto,
} from "@grasp/ai";
import {
  createArtifactReviewRunRepository,
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
const artifactReviewRunRepository = createArtifactReviewRunRepository(db);
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

      const extractWorkflow = mastra.getWorkflow("extractConceptsWorkflow");
      const workflowRun = await extractWorkflow.createRun({
        resourceId: project.id,
      });
      const workflowResult = await workflowRun.start({
        inputData: {
          sourceMaterial: buildExtractionSourceMaterial(
            project.sourceMaterial,
            job.data.revisionFeedback
          ),
        },
      });

      if (workflowResult.status !== "suspended") {
        throw new Error(
          `concept_extraction_workflow_unexpected_status:${workflowResult.status}`
        );
      }

      const suspendPayload = parseReviewConceptsSuspendPayload(
        workflowResult.suspendPayload
      );
      const extractedGraph = suspendPayload.conceptGraph;
      const artifact = await artifactRepository.findOrCreateForProject({
        projectId: project.id,
        status: "generating",
        type: "concept_graph",
      });
      const artifactVersion = await artifactRepository.createVersion({
        artifactId: artifact.id,
        content: extractedGraph,
        revisionFeedback: job.data.revisionFeedback ?? null,
      });
      const reviewRun = await artifactReviewRunRepository.createSuspended({
        artifactId: artifact.id,
        artifactVersionId: artifactVersion.id,
        resumeLabel: "review_concepts",
        resumeLabels: workflowResult.resumeLabels ?? null,
        suspendedSteps: workflowResult.suspended,
        workflowId: "extract-concepts",
        workflowRunId: workflowRun.runId,
      });

      await conceptRepository.replaceForProject(project.id, {
        concepts: extractedGraph.concepts.map((concept) => ({
          ...concept,
          confidence: concept.confidence.toFixed(2),
        })),
        relationships: extractedGraph.relationships,
      });
      await artifactRepository.updateStatus(artifact.id, "generated");
      const updatedProject = await projectRepository.updateStatus(project.id, "reviewing");

      await auditLogRepository.write({
        actorId: project.ownerId,
        action: "project.concept_extraction.completed",
        entityType: "project",
        entityId: project.id,
        metadata: {
          artifactId: artifact.id,
          artifactVersionId: artifactVersion.id,
          artifactReviewRunId: reviewRun.id,
          conceptCount: extractedGraph.concepts.length,
          relationshipCount: extractedGraph.relationships.length,
          revisionFeedback: job.data.revisionFeedback ?? null,
          workflowRunId: workflowRun.runId,
          workflowStatus: workflowResult.status,
          suspended: workflowResult.suspended,
          resumeLabels: workflowResult.resumeLabels ?? null,
          reviewReason: suspendPayload.reason,
          status: updatedProject?.status ?? "reviewing",
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

function buildExtractionSourceMaterial(
  sourceMaterial: string,
  revisionFeedback: string | null | undefined
) {
  const feedback = revisionFeedback?.trim();

  if (!feedback) {
    return sourceMaterial;
  }

  return [
    sourceMaterial,
    "",
    "Revision instructions from the creator:",
    feedback,
  ].join("\n");
}

function parseReviewConceptsSuspendPayload(
  payload: unknown
): ReviewConceptsSuspendDto {
  const reviewPayload = getReviewConceptsSuspendPayload(payload);

  if (reviewPayload) {
    return reviewPayload;
  }

  throw new Error("concept_extraction_workflow_missing_review_payload");
}

function getReviewConceptsSuspendPayload(
  payload: unknown
): ReviewConceptsSuspendDto | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "conceptGraph" in payload &&
    "reason" in payload &&
    payload.reason === "review_concepts"
  ) {
    return payload as ReviewConceptsSuspendDto;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "extract-concepts" in payload
  ) {
    return getReviewConceptsSuspendPayload(payload["extract-concepts"]);
  }

  return null;
}
