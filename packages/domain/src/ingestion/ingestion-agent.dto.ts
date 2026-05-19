import { z } from 'zod';
import { conceptDifficultyDto } from '../concepts';

export const ingestionSourceRefDto = z.object({
  blockId: z.string().trim().min(1),
  quote: z.string().trim().min(1),
  locationLabel: z.string().trim().default('unknown'),
});

export const ingestionConceptDto = z.object({
  conceptKey: z.string().trim().min(1),
  name: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  difficulty: conceptDifficultyDto,
  confidence: z.number().min(0).max(1),
  sourceRefs: z.array(ingestionSourceRefDto).min(1),
  mergesWith: z.string().trim().min(1).nullish().transform((v) => v ?? undefined),
});

export const ingestionRelationshipDto = z.object({
  sourceConceptKey: z.string().trim().min(1),
  targetConceptKey: z.string().trim().min(1),
  relationshipType: z.literal('prerequisite'),
  rationale: z.string().trim().min(1).optional(),
  sourceRefs: z.array(ingestionSourceRefDto).min(1),
});

export const ingestionAgentOutputDto = z.object({
  concepts: z.array(ingestionConceptDto).min(1),
  relationships: z.array(ingestionRelationshipDto).default([]),
});

export type IngestionAgentOutput = z.infer<typeof ingestionAgentOutputDto>;
export type IngestionConcept = z.infer<typeof ingestionConceptDto>;
export type IngestionRelationship = z.infer<typeof ingestionRelationshipDto>;
export type IngestionSourceRef = z.infer<typeof ingestionSourceRefDto>;
