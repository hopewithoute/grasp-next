import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractConceptGraph } from "./extract-concept-graph";

const validGraph = {
  concepts: [
    {
      confidence: 0.9,
      definition: "Photosynthesis uses light to make food.",
      difficulty: "beginner",
      name: "Photosynthesis",
      sourceEvidence: [
        {
          excerpt: "Photosynthesis uses light to make food.",
        },
      ],
    },
  ],
  relationships: [],
};

describe("extractConceptGraph", () => {
  it("uses deterministic extraction only when no LLM provider is configured", async () => {
    const result = await extractConceptGraph(
      {
        sourceMaterial: "Photosynthesis uses light to make food.",
      },
      {
        agent: {
          generate: async () => {
            throw new Error("agent_should_not_be_called");
          },
        },
        hasConfiguredLlmProvider: () => false,
      }
    );

    assert.equal(result.extractionMode, "deterministic");
    assert.equal(result.graph.concepts.length, 1);
  });

  it("returns strict LLM output when structured extraction succeeds", async () => {
    const result = await extractConceptGraph(
      {
        sourceMaterial: "Photosynthesis uses light to make food.",
      },
      {
        agent: {
          generate: async () => ({
            object: validGraph,
          }),
        },
        hasConfiguredLlmProvider: () => true,
      }
    );

    assert.equal(result.extractionMode, "llm_strict");
    assert.equal(result.graph.concepts[0].name, "Photosynthesis");
  });

  it("retries with loose JSON when structured output is unsupported", async () => {
    const prompts: string[] = [];

    const result = await extractConceptGraph(
      {
        sourceMaterial: "Photosynthesis uses light to make food.",
      },
      {
        agent: {
          generate: async (prompt) => {
            prompts.push(prompt);

            if (prompts.length === 1) {
              throw new Error("response_format type is unavailable now");
            }

            return {
              text: JSON.stringify(validGraph),
            };
          },
        },
        hasConfiguredLlmProvider: () => true,
      }
    );

    assert.equal(result.extractionMode, "llm_json");
    assert.equal(prompts.length, 2);
  });

  it("normalizes common loose JSON provider variants", async () => {
    const result = await extractConceptGraph(
      {
        sourceMaterial: "Photosynthesis uses light to make food.",
      },
      {
        agent: {
          generate: async (_prompt, options) => {
            if (options?.structuredOutput) {
              throw new Error("response_format type is unavailable now");
            }

            return {
              text: JSON.stringify({
                concepts: [
                  {
                    confidence: "high",
                    definition: "Photosynthesis uses light to make food.",
                    difficulty: "beginner",
                    name: "Photosynthesis",
                    source_evidence: "Photosynthesis uses light to make food.",
                  },
                ],
                relationships: [],
              }),
            };
          },
        },
        hasConfiguredLlmProvider: () => true,
      }
    );

    assert.equal(result.extractionMode, "llm_json");
    assert.equal(result.graph.concepts[0].confidence, 0.85);
    assert.deepEqual(result.graph.concepts[0].sourceEvidence, [
      {
        excerpt: "Photosynthesis uses light to make food.",
      },
    ]);
  });

  it("fails loudly when a configured LLM provider cannot be reached", async () => {
    await assert.rejects(
      extractConceptGraph(
        {
          sourceMaterial: "Photosynthesis uses light to make food.",
        },
        {
          agent: {
            generate: async () => {
              throw new Error("connect EPERM 127.0.0.1:8317");
            },
          },
          hasConfiguredLlmProvider: () => true,
        }
      ),
      /connect EPERM/
    );
  });
});
