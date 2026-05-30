import { z } from 'zod';
import type { IngestionRelationClaim } from '../index';

export const linkCandidateDto = z.object({
  candidateId: z.string().trim().min(1),
  evidence: z.object({
    blockId: z.string().trim().min(1),
    locationLabel: z.string().trim().min(1),
    quote: z.string().trim().min(1),
  }),
  reason: z.string().trim().min(1),
  relationshipType: z.enum(['prerequisite', 'part_of', 'related_to', 'explains']),
  resolutionType: z.enum(['exact', 'semantic']),
  sourceConceptKey: z.string().trim().min(1),
  sourceConceptName: z.string().trim().min(1),
  targetConceptKey: z.string().trim().min(1),
  targetConceptName: z.string().trim().min(1),
  type: z.literal('add_relationship'),
});

export const evidenceQualityDto = z.object({
  evidenceKind: z.enum(['heading', 'sentence', 'paragraph', 'list', 'unknown']),
  evidenceReason: z.string().trim().min(1),
  evidenceStrength: z.enum(['strong', 'usable', 'weak', 'rejected']),
  finalEvidenceScore: z.number().min(0).max(1),
  grounded: z.boolean(),
  groundingReason: z.enum(['exact_quote', 'quote_not_found', 'missing_block', 'empty_quote']),
  relationshipTypeConfidence: z.number().min(0).max(1),
  semanticSupportConfidence: z.number().min(0).max(1),
  shapeScore: z.number().min(0).max(1),
  suggestedRelationshipType: z
    .enum(['prerequisite', 'part_of', 'related_to', 'explains'])
    .optional(),
});

export const reviewedLinkDto = linkCandidateDto.extend({
  confidence: z.number().min(0).max(1),
  decision: z.enum(['accept', 'reject']),
  evidenceQuality: evidenceQualityDto,
  rationale: z.string().trim().min(1),
});

export type LinkCandidate = z.infer<typeof linkCandidateDto>;
export type EvidenceQuality = z.infer<typeof evidenceQualityDto>;
export type ReviewedLink = z.infer<typeof reviewedLinkDto>;

export const linkPolicyResultDto = z.object({
  candidateId: z.string().trim().min(1),
  decision: z.enum(['accept', 'reject']),
  reason: z.string().trim().min(1),
});

export const linkTraceDto = z.object({
  acceptedLinks: z.array(reviewedLinkDto),
  appliedLinks: z.array(reviewedLinkDto),
  candidates: z.array(linkCandidateDto),
  metrics: z.object({
    acceptedCount: z.number().int().nonnegative(),
    appliedCount: z.number().int().nonnegative(),
    averageAcceptedConfidence: z.number().min(0).max(1),
    averageAcceptedEvidenceScore: z.number().min(0).max(1),
    candidateCount: z.number().int().nonnegative(),
    exactMatchCandidateCount: z.number().int().nonnegative(),
    missingDecisionCount: z.number().int().nonnegative(),
    rejectedCount: z.number().int().nonnegative(),
    relationClaimCount: z.number().int().nonnegative(),
    reviewedCount: z.number().int().nonnegative(),
    semanticCandidateCount: z.number().int().nonnegative(),
    weakEvidenceCount: z.number().int().nonnegative(),
  }),
  policyResults: z.array(linkPolicyResultDto),
  relationClaims: z.array(z.custom<IngestionRelationClaim>()),
  rejectedLinks: z.array(reviewedLinkDto),
  reviewedLinks: z.array(reviewedLinkDto),
});

export type LinkPolicyResult = z.infer<typeof linkPolicyResultDto>;
export type LinkTrace = z.infer<typeof linkTraceDto>;

export const MIN_LINK_CONFIDENCE = 0.7;
export const MIN_LINK_EVIDENCE_SCORE = 0.6;

export type ExistingConceptSearch = (input: {
  limit?: number;
  query: string;
}) => Promise<Array<{ conceptKey: string; definition: string; name: string }>>;

export type ExistingConceptContextLoader = (
  conceptKey: string
) => Promise<IngestionConceptContext | null>;

// Re-import for the type alias
import type { IngestionConceptContext } from '../knowledgebase';
