import {
  extractedConceptGraphDto,
  type ExtractedConceptGraphDto,
} from "@grasp/domain";
import { conceptExtractorAgent } from "../mastra/agents/concept-extractor-agent";
import { canUseAgentModel } from "../model-resolver";
import { conceptGraphJsonSchema } from "./concept-graph-json-schema";
import { extractConceptsDeterministically } from "./deterministic-concept-extractor";
import {
  buildConceptExtractionPrompt,
  buildLooserConceptExtractionPrompt,
} from "./prompts";
import {
  getGeneratedText,
  normalizeLooseJsonResponse,
  parseLooseJsonResponse,
} from "./response-helpers";
import { isUnsupportedStructuredOutputError } from "./error-utils";

export type ExtractConceptGraphInput = {
  sourceMaterial: string;
};

export type ExtractConceptGraphResult = {
  graph: ExtractedConceptGraphDto;
  extractionMode: "llm_strict" | "llm_json" | "deterministic";
};

type ConceptExtractorAgent = {
  generate: (
    prompt: string,
    options?: {
      structuredOutput?: {
        schema: typeof conceptGraphJsonSchema;
      };
    }
  ) => Promise<{ object?: unknown; text?: unknown; content?: unknown }>;
};

type ExtractConceptGraphDependencies = {
  agent: ConceptExtractorAgent;
  hasConfiguredLlmProvider: () => boolean;
};

const defaultDependencies: ExtractConceptGraphDependencies = {
  agent: conceptExtractorAgent,
  hasConfiguredLlmProvider,
};

export async function extractConceptGraph(
  input: ExtractConceptGraphInput,
  dependencies: ExtractConceptGraphDependencies = defaultDependencies
): Promise<ExtractConceptGraphResult> {
  if (!dependencies.hasConfiguredLlmProvider()) {
    return {
      graph: extractConceptsDeterministically(input.sourceMaterial),
      extractionMode: "deterministic",
    };
  }

  try {
    const response = await dependencies.agent.generate(
      buildConceptExtractionPrompt(input.sourceMaterial),
      {
        structuredOutput: {
          schema: conceptGraphJsonSchema,
        },
      }
    );

    return {
      graph: extractedConceptGraphDto.parse(response.object),
      extractionMode: "llm_strict",
    };
  } catch (error) {
    if (!isUnsupportedStructuredOutputError(error)) {
      throw error;
    }

    const response = await dependencies.agent.generate(
      buildLooserConceptExtractionPrompt(input.sourceMaterial)
    );
    const parsed = extractedConceptGraphDto.parse(
      normalizeLooseJsonResponse(parseLooseJsonResponse(getGeneratedText(response)))
    );

    return {
      graph: parsed,
      extractionMode: "llm_json",
    };
  }
}

function hasConfiguredLlmProvider() {
  return canUseAgentModel("conceptExtractor");
}
