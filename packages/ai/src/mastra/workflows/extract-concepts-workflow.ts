import { createStep, createWorkflow } from "@mastra/core/workflows";
import type { PublicSchema } from "@mastra/core/schema";
import type { ExtractedConceptGraphDto } from "@grasp/domain";
import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import { conceptGraphJsonSchema } from "../../concept-extraction/concept-graph-json-schema";
import { extractConceptGraph } from "../../concept-extraction/extract-concept-graph";

export const extractConceptsWorkflowInputDto = z.object({
  sourceMaterial: z.string().trim().min(1),
});

export const reviewConceptsResumeDto = z.object({
  approved: z.boolean(),
});

export type ReviewConceptsSuspendDto = {
  conceptGraph: ExtractedConceptGraphDto;
  reason: "review_concepts";
};

export const conceptGraphWorkflowSchema =
  conceptGraphJsonSchema as PublicSchema<ExtractedConceptGraphDto>;

export const reviewConceptsSuspendJsonSchema = {
  type: "object",
  properties: {
    conceptGraph: conceptGraphJsonSchema,
    reason: {
      type: "string",
      const: "review_concepts",
    },
  },
  required: ["conceptGraph", "reason"],
  additionalProperties: false,
} satisfies JSONSchema7;

export const reviewConceptsSuspendSchema =
  reviewConceptsSuspendJsonSchema as PublicSchema<ReviewConceptsSuspendDto>;

export const extractConceptsStep = createStep({
  id: "extract-concepts",
  inputSchema: extractConceptsWorkflowInputDto,
  outputSchema: conceptGraphWorkflowSchema,
  resumeSchema: reviewConceptsResumeDto,
  suspendSchema: reviewConceptsSuspendSchema,
  execute: async ({ inputData, resumeData, suspend, suspendData }) => {
    const conceptGraph = getConceptGraphForExecution(inputData, suspendData);

    if (!resumeData?.approved) {
      return await suspend(
        {
          conceptGraph: await conceptGraph,
          reason: "review_concepts",
        },
        {
          resumeLabel: "review_concepts",
        }
      );
    }

    return conceptGraph;
  },
});

export const extractConceptsWorkflow = createWorkflow({
  id: "extract-concepts",
  inputSchema: extractConceptsWorkflowInputDto,
  outputSchema: conceptGraphWorkflowSchema,
})
  .then(extractConceptsStep)
  .commit();

function getConceptGraphForExecution(
  inputData: z.infer<typeof extractConceptsWorkflowInputDto>,
  suspendData: unknown
): Promise<ExtractedConceptGraphDto> | ExtractedConceptGraphDto {
  if (isReviewConceptsSuspendDto(suspendData)) {
    return suspendData.conceptGraph;
  }

  return extractConceptGraph({
    sourceMaterial: inputData.sourceMaterial,
  });
}

function isReviewConceptsSuspendDto(
  value: unknown
): value is ReviewConceptsSuspendDto {
  return (
    typeof value === "object" &&
    value !== null &&
    "conceptGraph" in value &&
    "reason" in value &&
    value.reason === "review_concepts"
  );
}
