import { conceptDifficultyDto } from '../concepts';
import { RELATIONSHIP_TYPES } from '../constants';
import { knowledgebaseRelationshipTypeDto } from '../knowledgebase';
import { confidenceScore, requiredString, v } from '../validation';

export const ingestionSourceRefDto = v.object({
  blockId: requiredString,
  quote: requiredString,
  locationLabel: v.optional(v.pipe(v.string(), v.trim()), 'unknown'),
});

export const ingestionEvidenceQualityDto = v.object({
  evidenceKind: v.picklist(['heading', 'sentence', 'paragraph', 'list', 'unknown']),
  evidenceReason: requiredString,
  evidenceStrength: v.picklist(['strong', 'usable', 'weak', 'rejected']),
  finalEvidenceScore: confidenceScore,
  grounded: v.boolean(),
  groundingReason: v.picklist(['exact_quote', 'quote_not_found', 'missing_block', 'empty_quote']),
  relationshipTypeConfidence: confidenceScore,
  semanticSupportConfidence: confidenceScore,
  shapeScore: confidenceScore,
  suggestedRelationshipType: v.optional(knowledgebaseRelationshipTypeDto),
});

export const ingestionConceptDto = v.object({
  conceptKey: requiredString,
  name: requiredString,
  definition: requiredString,
  difficulty: conceptDifficultyDto,
  confidence: confidenceScore,
  sourceRefs: v.pipe(v.array(ingestionSourceRefDto), v.minLength(1)),
  mergesWith: v.fallback(v.optional(requiredString), undefined),
});

export const ingestionRelationshipDto = v.object({
  sourceConceptKey: requiredString,
  targetConceptKey: requiredString,
  relationshipType: knowledgebaseRelationshipTypeDto,
  rationale: v.optional(requiredString),
  sourceRefs: v.optional(v.array(ingestionSourceRefDto), []),
  evidenceQuality: v.optional(ingestionEvidenceQualityDto),
});

export const ingestionRelationClaimPredicateDto = v.picklist(RELATIONSHIP_TYPES);

export const ingestionRelationClaimDto = v.object({
  subjectText: requiredString,
  predicate: ingestionRelationClaimPredicateDto,
  objectText: requiredString,
  sourceRefs: v.optional(v.array(ingestionSourceRefDto), []),
});

export const ingestionAgentOutputDto = v.object({
  concepts: v.optional(v.array(ingestionConceptDto), []),
  relationClaims: v.optional(v.array(ingestionRelationClaimDto), []),
  relationships: v.optional(v.array(ingestionRelationshipDto), []),
});

export type IngestionAgentOutput = v.InferOutput<typeof ingestionAgentOutputDto>;
export type IngestionConcept = v.InferOutput<typeof ingestionConceptDto>;
export type IngestionRelationClaim = v.InferOutput<typeof ingestionRelationClaimDto>;
export type IngestionRelationship = v.InferOutput<typeof ingestionRelationshipDto>;
export type IngestionSourceRef = v.InferOutput<typeof ingestionSourceRefDto>;
export type IngestionEvidenceQuality = v.InferOutput<typeof ingestionEvidenceQualityDto>;
