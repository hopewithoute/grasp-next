import { z } from 'zod';
import type {
  IngestionAgentOutput,
  IngestionConcept,
  IngestionConceptContext,
  IngestionRelationClaim,
  IngestionRelationship,
  KnowledgebaseRelationshipTypeDto,
} from '@grasp/domain';

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

const MIN_LINK_CONFIDENCE = 0.7;
const MIN_LINK_EVIDENCE_SCORE = 0.6;

export type ExistingConceptSearch = (input: {
  limit?: number;
  query: string;
}) => Promise<Array<{ conceptKey: string; definition: string; name: string }>>;

export type ExistingConceptContextLoader = (
  conceptKey: string
) => Promise<IngestionConceptContext | null>;

export async function buildLinkCandidates(input: {
  getConceptContext: ExistingConceptContextLoader;
  localExtraction: IngestionAgentOutput;
  searchConcepts: ExistingConceptSearch;
}): Promise<LinkCandidate[]> {
  const candidates: LinkCandidate[] = [];
  const seen = new Set<string>();
  const claims = [
    ...input.localExtraction.relationClaims,
    ...inferRelationClaimsFromConceptEvidence(input.localExtraction.concepts),
  ];

  for (const claim of claims) {
    const targetConcept = findLocalConcept(claim.subjectText, input.localExtraction.concepts);
    if (!targetConcept) {
      continue;
    }

    const relationshipType = relationshipTypeForPredicate(claim.predicate);
    const matches = await input.searchConcepts({ limit: 5, query: claim.objectText });
    const exactMatches = matches.filter((match) => isExactConceptMatch(claim.objectText, match));
    const candidateMatches = exactMatches.length ? exactMatches : matches;
    const resolutionType = exactMatches.length ? 'exact' : 'semantic';

    for (const match of candidateMatches) {
      const context = await input.getConceptContext(match.conceptKey);
      const sourceConcept = context?.concept ?? match;
      if (sourceConcept.conceptKey === targetConcept.conceptKey) {
        continue;
      }

      const key = `${sourceConcept.conceptKey}:${targetConcept.conceptKey}:${relationshipType}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push({
        candidateId: `candidate:${key}`,
        evidence: claim.sourceRefs[0],
        reason: `Relation claim "${claim.subjectText} ${claim.predicate} ${claim.objectText}" resolved "${claim.objectText}" to existing concept "${sourceConcept.name}".`,
        relationshipType,
        resolutionType,
        sourceConceptKey: sourceConcept.conceptKey,
        sourceConceptName: sourceConcept.name,
        targetConceptKey: targetConcept.conceptKey,
        targetConceptName: targetConcept.name,
        type: 'add_relationship',
      });
    }
  }

  return candidates;
}

export function applyLinkPolicy(input: {
  extraction: IngestionAgentOutput;
  reviewedLinks: ReviewedLink[];
}): { policyResults: LinkPolicyResult[]; reviewedLinks: ReviewedLink[] } {
  const existingRelationships = new Set(
    input.extraction.relationships.map((relationship) => relationshipKey(relationship))
  );
  const acceptedRelationships = new Set<string>();
  const policyResults: LinkPolicyResult[] = [];
  const reviewedLinks = input.reviewedLinks.map((link) => {
    const policyReason = linkPolicyRejectionReason(
      link,
      existingRelationships,
      acceptedRelationships
    );

    if (policyReason) {
      policyResults.push({
        candidateId: link.candidateId,
        decision: 'reject',
        reason: policyReason,
      });

      return {
        ...link,
        decision: 'reject' as const,
        rationale: `${link.rationale} Policy rejected: ${policyReason}`,
      };
    }

    if (link.decision === 'accept') {
      acceptedRelationships.add(relationshipKey(link));
    }

    policyResults.push({
      candidateId: link.candidateId,
      decision: link.decision,
      reason: link.decision === 'accept' ? 'passed_link_policy' : 'model_rejected',
    });

    return link;
  });

  return { policyResults, reviewedLinks };
}

export function buildLinkTrace(input: {
  acceptedLinks: ReviewedLink[];
  appliedLinks: ReviewedLink[];
  candidates: LinkCandidate[];
  extraction: IngestionAgentOutput;
  policyResults: LinkPolicyResult[];
  rejectedLinks: ReviewedLink[];
  reviewedLinks: ReviewedLink[];
}): LinkTrace {
  const acceptedConfidenceSum = input.acceptedLinks.reduce(
    (sum, link) => sum + link.confidence,
    0
  );
  const acceptedEvidenceScoreSum = input.acceptedLinks.reduce(
    (sum, link) => sum + link.evidenceQuality.finalEvidenceScore,
    0
  );

  return {
    acceptedLinks: input.acceptedLinks,
    appliedLinks: input.appliedLinks,
    candidates: input.candidates,
    metrics: {
      acceptedCount: input.acceptedLinks.length,
      appliedCount: input.appliedLinks.length,
      averageAcceptedConfidence: input.acceptedLinks.length
        ? acceptedConfidenceSum / input.acceptedLinks.length
        : 0,
      averageAcceptedEvidenceScore: input.acceptedLinks.length
        ? acceptedEvidenceScoreSum / input.acceptedLinks.length
        : 0,
      candidateCount: input.candidates.length,
      exactMatchCandidateCount: input.candidates.filter(
        (candidate) => candidate.resolutionType === 'exact'
      ).length,
      missingDecisionCount: Math.max(0, input.candidates.length - input.reviewedLinks.length),
      rejectedCount: input.rejectedLinks.length,
      relationClaimCount: input.extraction.relationClaims.length,
      reviewedCount: input.reviewedLinks.length,
      semanticCandidateCount: input.candidates.filter(
        (candidate) => candidate.resolutionType === 'semantic'
      ).length,
      weakEvidenceCount: input.reviewedLinks.filter(
        (link) =>
          link.evidenceQuality.evidenceStrength === 'weak' ||
          link.evidenceQuality.evidenceStrength === 'rejected'
      ).length,
    },
    policyResults: input.policyResults,
    relationClaims: input.extraction.relationClaims,
    rejectedLinks: input.rejectedLinks,
    reviewedLinks: input.reviewedLinks,
  };
}

export function applyAcceptedLinks(
  extraction: IngestionAgentOutput,
  reviewedLinks: ReviewedLink[]
): IngestionAgentOutput {
  const relationshipsByKey = new Map(
    extraction.relationships.map((relationship) => [
      relationshipKey(relationship),
      relationship,
    ])
  );

  for (const link of reviewedLinks) {
    if (link.decision !== 'accept') {
      continue;
    }

    const relationship: IngestionRelationship = {
      evidenceQuality: link.evidenceQuality,
      rationale: link.rationale,
      relationshipType: link.relationshipType,
      sourceConceptKey: link.sourceConceptKey,
      sourceRefs: [link.evidence],
      targetConceptKey: link.targetConceptKey,
    };
    relationshipsByKey.set(relationshipKey(relationship), relationship);
  }

  return {
    ...extraction,
    relationships: [...relationshipsByKey.values()],
  };
}

export function reviewLinksDeterministically(
  candidates: LinkCandidate[]
): ReviewedLink[] {
  return candidates.map((candidate) => {
    const evidenceQuality = scoreLinkEvidence({
      relationshipType: candidate.relationshipType,
      semanticSupportConfidence: candidate.relationshipType === 'prerequisite' ? 0.92 : 0.82,
      quote: candidate.evidence.quote,
      relationshipTypeConfidence: candidate.relationshipType === 'prerequisite' ? 0.9 : 0.82,
    });

    return {
      ...candidate,
      confidence: evidenceQuality.finalEvidenceScore,
      decision: evidenceQuality.evidenceStrength === 'rejected' ? 'reject' : 'accept',
      evidenceQuality,
      rationale: candidate.reason,
    };
  });
}

export function scoreLinkEvidence(input: {
  quote: string;
  relationshipType: KnowledgebaseRelationshipTypeDto;
  relationshipTypeConfidence: number;
  semanticSupportConfidence: number;
  suggestedRelationshipType?: KnowledgebaseRelationshipTypeDto;
}): EvidenceQuality {
  const quote = input.quote.trim();

  if (!quote) {
    return rejectedEvidenceQuality('empty_quote');
  }

  const { evidenceKind, evidenceReason, shapeScore } = scoreEvidenceShape(
    quote,
    input.relationshipType
  );
  const semanticSupportConfidence = clampScore(input.semanticSupportConfidence);
  const relationshipTypeConfidence = clampScore(input.relationshipTypeConfidence);
  const rawFinalEvidenceScore =
    0.5 * semanticSupportConfidence + 0.3 * relationshipTypeConfidence + 0.2 * shapeScore;
  const finalEvidenceScore =
    evidenceKind === 'heading' ? Math.min(rawFinalEvidenceScore, 0.45) : rawFinalEvidenceScore;
  const evidenceStrength = evidenceStrengthForScore(finalEvidenceScore);

  return {
    evidenceKind,
    evidenceReason,
    evidenceStrength,
    finalEvidenceScore,
    grounded: true,
    groundingReason: 'exact_quote',
    relationshipTypeConfidence,
    semanticSupportConfidence,
    shapeScore,
    suggestedRelationshipType: input.suggestedRelationshipType,
  };
}

function relationshipTypeForPredicate(
  predicate: IngestionRelationClaim['predicate']
): KnowledgebaseRelationshipTypeDto {
  if (predicate === 'part_of') {
    return 'part_of';
  }

  if (predicate === 'explains') {
    return 'explains';
  }

  if (predicate === 'related_to') {
    return 'related_to';
  }

  return 'prerequisite';
}

function findLocalConcept(subjectText: string, concepts: IngestionConcept[]) {
  const normalizedSubject = normalizeText(subjectText);
  return concepts.find((concept) => {
    return (
      normalizeText(concept.conceptKey) === normalizedSubject ||
      normalizeText(concept.name) === normalizedSubject ||
      normalizedSubject.includes(normalizeText(concept.name)) ||
      normalizeText(concept.name).includes(normalizedSubject)
    );
  });
}

function inferRelationClaimsFromConceptEvidence(
  concepts: IngestionConcept[]
): IngestionRelationClaim[] {
  const claims: IngestionRelationClaim[] = [];

  for (const concept of concepts) {
    for (const ref of concept.sourceRefs) {
      const buildsOnMatch = ref.quote.match(
        /\b(?:it|this|[A-Z][A-Za-z\s-]+)\s+builds on(?: the)?(?: foundational)? concepts? of ([^.]+)\./i
      );

      if (buildsOnMatch?.[1]) {
        claims.push({
          objectText: buildsOnMatch[1].trim(),
          predicate: 'builds_on',
          sourceRefs: [ref],
          subjectText: concept.name,
        });
      }
    }
  }

  return claims;
}

function relationshipKey(relationship: Pick<IngestionRelationship, 'relationshipType' | 'sourceConceptKey' | 'targetConceptKey'>) {
  return `${relationship.sourceConceptKey}:${relationship.targetConceptKey}:${relationship.relationshipType}`;
}

function linkPolicyRejectionReason(
  link: ReviewedLink,
  existingRelationships: Set<string>,
  acceptedRelationships: Set<string>
) {
  if (link.decision === 'reject') {
    return null;
  }

  if (link.sourceConceptKey === link.targetConceptKey) {
    return 'self_edge';
  }

  if (link.confidence < MIN_LINK_CONFIDENCE) {
    return 'confidence_below_threshold';
  }

  if (!link.evidence.blockId || !link.evidence.quote.trim()) {
    return 'missing_evidence';
  }

  if (link.evidenceQuality.finalEvidenceScore < MIN_LINK_EVIDENCE_SCORE) {
    return 'evidence_score_below_threshold';
  }

  if (
    link.relationshipType === 'prerequisite' &&
    link.evidenceQuality.relationshipTypeConfidence < MIN_LINK_CONFIDENCE
  ) {
    return 'relationship_type_confidence_below_threshold';
  }

  const key = relationshipKey(link);

  if (existingRelationships.has(key) || acceptedRelationships.has(key)) {
    return 'duplicate_relationship';
  }

  return null;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function rejectedEvidenceQuality(
  groundingReason: EvidenceQuality['groundingReason']
): EvidenceQuality {
  return {
    evidenceKind: 'unknown',
    evidenceReason: groundingReason,
    evidenceStrength: 'rejected',
    finalEvidenceScore: 0,
    grounded: false,
    groundingReason,
    relationshipTypeConfidence: 0,
    semanticSupportConfidence: 0,
    shapeScore: 0,
  };
}

function scoreEvidenceShape(
  quote: string,
  relationshipType: KnowledgebaseRelationshipTypeDto
): Pick<EvidenceQuality, 'evidenceKind' | 'evidenceReason' | 'shapeScore'> {
  const normalized = quote.trim();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const hasSentencePunctuation = /[.!?]$/.test(normalized);
  const hasPrerequisiteLanguage =
    /\b(builds on|requires|depends on|foundational|prerequisite)\b/i.test(normalized);
  const hasExplanatoryLanguage =
    /\b(because|therefore|explains|causes|affect|affects|helps|leads to|connects)\b/i.test(
      normalized
    );
  const evidenceKind =
    wordCount <= 5 && !hasSentencePunctuation
      ? 'heading'
      : normalized.includes('\n-') || normalized.startsWith('- ')
        ? 'list'
        : wordCount >= 18
          ? 'paragraph'
          : 'sentence';

  let shapeScore = evidenceKind === 'heading' ? 0.35 : evidenceKind === 'sentence' ? 0.75 : 0.85;
  const reasons: string[] = [evidenceKind];

  if (wordCount <= 4) {
    shapeScore -= 0.2;
    reasons.push('too_short');
  }

  if (relationshipType === 'prerequisite' && hasPrerequisiteLanguage) {
    shapeScore += 0.1;
    reasons.push('prerequisite_language');
  }

  if (
    (relationshipType === 'explains' || relationshipType === 'related_to') &&
    hasExplanatoryLanguage
  ) {
    shapeScore += 0.1;
    reasons.push('explanatory_language');
  }

  return {
    evidenceKind,
    evidenceReason: reasons.join('+'),
    shapeScore: clampScore(shapeScore),
  };
}

function evidenceStrengthForScore(score: number): EvidenceQuality['evidenceStrength'] {
  if (score >= 0.8) return 'strong';
  if (score >= 0.6) return 'usable';
  if (score >= 0.4) return 'weak';
  return 'rejected';
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function isExactConceptMatch(
  query: string,
  concept: { conceptKey: string; name: string }
) {
  const normalizedQuery = normalizeText(query);

  return (
    normalizeText(concept.conceptKey) === normalizedQuery ||
    normalizeText(concept.name) === normalizedQuery
  );
}
