import {
  extractedConceptGraphDto,
  type ExtractedConceptGraphDto,
} from "@grasp/domain";
import { conceptExtractorAgent } from "../mastra/agents/concept-extractor-agent";
import { canUseAgentModel } from "../model-resolver";
import { conceptGraphJsonSchema } from "./concept-graph-json-schema";
import { extractConceptsDeterministically } from "./deterministic-concept-extractor";

export type ExtractConceptGraphInput = {
  sourceMaterial: string;
};

export async function extractConceptGraph(
  input: ExtractConceptGraphInput
): Promise<ExtractedConceptGraphDto> {
  if (!hasConfiguredLlmProvider()) {
    return extractConceptsDeterministically(input.sourceMaterial);
  }

  const response = await conceptExtractorAgent.generate(
    buildConceptExtractionPrompt(input.sourceMaterial),
    {
      structuredOutput: {
        schema: conceptGraphJsonSchema,
      },
    }
  );

  return extractedConceptGraphDto.parse(response.object);
}

function hasConfiguredLlmProvider() {
  return canUseAgentModel("conceptExtractor");
}

function buildConceptExtractionPrompt(sourceMaterial: string) {
  return `
Extract the concept graph from this source material.

Rules:
- Return 3 to 8 important concepts when the material supports it.
- Every concept must have at least one source evidence excerpt copied from the material.
- Confidence must be a number from 0 to 1.
- Relationships must use concept names from the returned concepts.
- Use prerequisite relationships only when one concept should be understood before another.

Source material:
${sourceMaterial}
`;
}
