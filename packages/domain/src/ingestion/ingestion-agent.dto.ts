import { z } from 'zod';
import { conceptDifficultyDto } from '../concepts';
import { knowledgebaseRelationshipTypeDto } from '../knowledgebase';

export const ingestionSourceRefDto = z.object({
  blockId: z.string().trim().min(1),
  quote: z.string().trim().min(1),
  locationLabel: z.string().trim().default('unknown'),
});

export const ingestionEvidenceQualityDto = z.object({
  evidenceKind: z.enum(['heading', 'sentence', 'paragraph', 'list', 'unknown']),
  evidenceReason: z.string().trim().min(1),
  evidenceStrength: z.enum(['strong', 'usable', 'weak', 'rejected']),
  finalEvidenceScore: z.number().min(0).max(1),
  grounded: z.boolean(),
  groundingReason: z.enum(['exact_quote', 'quote_not_found', 'missing_block', 'empty_quote']),
  relationshipTypeConfidence: z.number().min(0).max(1),
  semanticSupportConfidence: z.number().min(0).max(1),
  shapeScore: z.number().min(0).max(1),
  suggestedRelationshipType: knowledgebaseRelationshipTypeDto.optional(),
});

export const ingestionConceptDto = z.object({
  conceptKey: z.string().trim().min(1),
  name: z.string().trim().min(1),
  definition: z.string().trim().min(1),
  difficulty: conceptDifficultyDto,
  confidence: z.number().min(0).max(1),
  sourceRefs: z.array(ingestionSourceRefDto).min(1),
  mergesWith: z.string().trim().min(1).optional().catch(undefined),
});

export const ingestionRelationshipDto = z.object({
  sourceConceptKey: z.string().trim().min(1),
  targetConceptKey: z.string().trim().min(1),
  relationshipType: knowledgebaseRelationshipTypeDto,
  rationale: z.string().trim().min(1).optional(),
  sourceRefs: z.array(ingestionSourceRefDto).min(1),
  evidenceQuality: ingestionEvidenceQualityDto.optional(),
});

export const ingestionRelationClaimPredicateDto = z.enum([
  'builds_on',
  'requires',
  'depends_on',
  'part_of',
  'explains',
  'related_to',
]);

export const ingestionRelationClaimDto = z.object({
  subjectText: z.string().trim().min(1),
  predicate: ingestionRelationClaimPredicateDto,
  objectText: z.string().trim().min(1),
  sourceRefs: z.array(ingestionSourceRefDto).min(1),
});

export const ingestionAgentOutputDto = z.object({
  concepts: z.array(ingestionConceptDto).default([]),
  relationClaims: z.array(ingestionRelationClaimDto).default([]),
  relationships: z.array(ingestionRelationshipDto).default([]),
});

export type IngestionAgentOutput = z.infer<typeof ingestionAgentOutputDto>;
export type IngestionConcept = z.infer<typeof ingestionConceptDto>;
export type IngestionRelationClaim = z.infer<typeof ingestionRelationClaimDto>;
export type IngestionRelationship = z.infer<typeof ingestionRelationshipDto>;
export type IngestionSourceRef = z.infer<typeof ingestionSourceRefDto>;
export type IngestionEvidenceQuality = z.infer<typeof ingestionEvidenceQualityDto>;
