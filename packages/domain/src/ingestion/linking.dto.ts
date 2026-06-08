import { RELATIONSHIP_TYPES } from '../constants';
import type { IngestionRelationClaim } from '../index';
import { confidenceScore, requiredString, v } from '../validation';

export const linkCandidateDto = v.object({
  candidateId: requiredString,
  evidence: v.object({
    blockId: requiredString,
    locationLabel: requiredString,
    quote: requiredString,
  }),
  reason: requiredString,
  relationshipType: v.picklist(RELATIONSHIP_TYPES),
  resolutionType: v.picklist(['exact', 'semantic']),
  sourceConceptKey: requiredString,
  sourceConceptName: requiredString,
  targetConceptKey: requiredString,
  targetConceptName: requiredString,
  type: v.literal('add_relationship'),
});

export const evidenceQualityDto = v.object({
  evidenceKind: v.picklist(['heading', 'sentence', 'paragraph', 'list', 'unknown']),
  evidenceReason: requiredString,
  evidenceStrength: v.picklist(['strong', 'usable', 'weak', 'rejected']),
  finalEvidenceScore: confidenceScore,
  grounded: v.boolean(),
  groundingReason: v.picklist(['exact_quote', 'quote_not_found', 'missing_block', 'empty_quote']),
  relationshipTypeConfidence: confidenceScore,
  semanticSupportConfidence: confidenceScore,
  shapeScore: confidenceScore,
  suggestedRelationshipType: v.optional(v.picklist(RELATIONSHIP_TYPES)),
});

export const reviewedLinkDto = v.object({
  ...linkCandidateDto.entries,
  confidence: confidenceScore,
  decision: v.picklist(['accept', 'reject']),
  evidenceQuality: evidenceQualityDto,
  rationale: requiredString,
});

export type LinkCandidate = v.InferOutput<typeof linkCandidateDto>;
export type EvidenceQuality = v.InferOutput<typeof evidenceQualityDto>;
export type ReviewedLink = v.InferOutput<typeof reviewedLinkDto>;

export const linkPolicyResultDto = v.object({
  candidateId: requiredString,
  decision: v.picklist(['accept', 'reject']),
  reason: requiredString,
});

const nonNegativeInteger = v.pipe(v.number(), v.integer(), v.minValue(0));

export const linkTraceDto = v.object({
  acceptedLinks: v.array(reviewedLinkDto),
  appliedLinks: v.array(reviewedLinkDto),
  candidates: v.array(linkCandidateDto),
  metrics: v.object({
    acceptedCount: nonNegativeInteger,
    appliedCount: nonNegativeInteger,
    averageAcceptedConfidence: confidenceScore,
    averageAcceptedEvidenceScore: confidenceScore,
    candidateCount: nonNegativeInteger,
    exactMatchCandidateCount: nonNegativeInteger,
    missingDecisionCount: nonNegativeInteger,
    rejectedCount: nonNegativeInteger,
    relationClaimCount: nonNegativeInteger,
    reviewedCount: nonNegativeInteger,
    semanticCandidateCount: nonNegativeInteger,
    weakEvidenceCount: nonNegativeInteger,
  }),
  policyResults: v.array(linkPolicyResultDto),
  relationClaims: v.array(v.unknown() as v.GenericSchema<IngestionRelationClaim>),
  rejectedLinks: v.array(reviewedLinkDto),
  reviewedLinks: v.array(reviewedLinkDto),
});

export type LinkPolicyResult = v.InferOutput<typeof linkPolicyResultDto>;
export type LinkTrace = v.InferOutput<typeof linkTraceDto>;

export const MIN_LINK_CONFIDENCE = 0.7;
export const MIN_LINK_EVIDENCE_SCORE = 0.6;
