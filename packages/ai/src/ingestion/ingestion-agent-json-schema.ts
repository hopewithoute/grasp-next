import type { JSONSchema7 } from 'json-schema';

export const ingestionAgentJsonSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          conceptKey: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          definition: { type: 'string', minLength: 1 },
          difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          mergesWith: { type: 'string' },
          sourceRefs: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                blockId: { type: 'string', minLength: 1 },
                quote: { type: 'string', minLength: 1 },
                locationLabel: { type: 'string', minLength: 1 },
              },
              required: ['blockId', 'quote'],
              additionalProperties: false,
            },
          },
        },
        required: ['conceptKey', 'name', 'definition', 'difficulty', 'confidence', 'sourceRefs'],
        additionalProperties: false,
      },
    },
    relationClaims: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['subjectText', 'predicate', 'objectText', 'sourceRefs'],
        properties: {
          subjectText: { type: 'string' },
          predicate: {
            type: 'string',
            enum: ['builds_on', 'requires', 'depends_on', 'part_of', 'explains', 'related_to'],
          },
          objectText: { type: 'string' },
          sourceRefs: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['blockId', 'quote'],
              properties: {
                blockId: { type: 'string' },
                quote: { type: 'string' },
                locationLabel: { type: 'string' },
              },
            },
          },
        },
      },
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sourceConceptKey: { type: 'string', minLength: 1 },
          targetConceptKey: { type: 'string', minLength: 1 },
          relationshipType: {
            type: 'string',
            enum: ['prerequisite', 'part_of', 'related_to', 'explains'],
          },
          rationale: { type: 'string' },
          sourceRefs: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                blockId: { type: 'string', minLength: 1 },
                quote: { type: 'string', minLength: 1 },
                locationLabel: { type: 'string' },
              },
              required: ['blockId', 'quote'],
              additionalProperties: false,
            },
          },
        },
        required: ['sourceConceptKey', 'targetConceptKey', 'relationshipType', 'sourceRefs'],
        additionalProperties: false,
      },
    },
  },
  required: ['concepts', 'relationClaims', 'relationships'],
  additionalProperties: false,
};
