import type { JSONSchema7 } from "json-schema";

export const conceptGraphJsonSchema: JSONSchema7 = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
          },
          definition: {
            type: "string",
            minLength: 1,
          },
          difficulty: {
            type: "string",
            enum: ["beginner", "intermediate", "advanced"],
          },
          name: {
            type: "string",
            minLength: 1,
          },
          sourceEvidence: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                excerpt: {
                  type: "string",
                  minLength: 1,
                },
                location: {
                  type: "string",
                },
              },
              required: ["excerpt"],
              additionalProperties: false,
            },
          },
        },
        required: [
          "confidence",
          "definition",
          "difficulty",
          "name",
          "sourceEvidence",
        ],
        additionalProperties: false,
      },
    },
    relationships: {
      type: "array",
      items: {
        type: "object",
        properties: {
          relationshipType: {
            type: "string",
            const: "prerequisite",
          },
          sourceConceptName: {
            type: "string",
            minLength: 1,
          },
          targetConceptName: {
            type: "string",
            minLength: 1,
          },
        },
        required: [
          "relationshipType",
          "sourceConceptName",
          "targetConceptName",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["concepts", "relationships"],
  additionalProperties: false,
};
