import type {
  IngestionAgentOutput,
  IngestionConcept,
  IngestionRelationClaim,
  IngestionRelationship,
  KnowledgebaseRelationshipTypeDto,
} from '../index';

// DTOs, types, and constants are in linking.dto.ts
export {
  linkCandidateDto,
  evidenceQualityDto,
  reviewedLinkDto,
  linkPolicyResultDto,
  linkTraceDto,
  MIN_LINK_CONFIDENCE,
  MIN_LINK_EVIDENCE_SCORE,
  type LinkCandidate,
  type EvidenceQuality,
  type ReviewedLink,
  type LinkPolicyResult,
  type LinkTrace,
  type ExistingConceptSearch,
  type ExistingConceptContextLoader,
} from './linking.dto';

import {
  MIN_LINK_CONFIDENCE,
  MIN_LINK_EVIDENCE_SCORE,
  type EvidenceQuality,
  type ExistingConceptContextLoader,
  type ExistingConceptSearch,
  type LinkCandidate,
  type ReviewedLink,
} from './linking.dto';

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
    const dbMatches = await input.searchConcepts({ limit: 5, query: claim.objectText });
    
    // Cross-chunk linking: Also look in the local extraction (spanning all chunks) for the target concept
    const localMatch = findLocalConcept(claim.objectText, input.localExtraction.concepts);
    const allMatches = [...dbMatches];
    
    if (localMatch && !allMatches.some(m => m.conceptKey === localMatch.conceptKey)) {
      allMatches.unshift({
        conceptKey: localMatch.conceptKey,
        name: localMatch.name,
        definition: localMatch.definition,
      });
    }

    const exactMatches = allMatches.filter((match) => isExactConceptMatch(claim.objectText, match));
    const candidateMatches = exactMatches.length ? exactMatches : allMatches;
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

      const evidenceQuote = claim.sourceRefs?.[0]?.quote ?? '';
      const evidenceLocation = claim.sourceRefs?.[0]?.locationLabel ?? '';

      candidates.push({
        candidateId: key,
        evidence: {
          blockId: claim.sourceRefs?.[0]?.blockId ?? '',
          locationLabel: evidenceLocation,
          quote: evidenceQuote,
        },
        reason: `Extracted from source: "${claim.predicate}" relationship between "${sourceConcept.name}" and "${targetConcept.name}".`,
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
}) {
  const existingRelationshipKeys = new Set(
    input.extraction.relationships.map(
      (r) => `${r.sourceConceptKey}:${r.targetConceptKey}:${r.relationshipType}`
    )
  );

  const acceptedRelationshipKeys = new Set<string>();
  const policyResults: Array<{ candidateId: string; decision: 'accept' | 'reject'; reason: string }> = [];

  for (const link of input.reviewedLinks) {
    const rejectionReason = linkPolicyRejectionReason(
      link,
      existingRelationshipKeys,
      acceptedRelationshipKeys
    );

    if (rejectionReason) {
      policyResults.push({
        candidateId: link.candidateId,
        decision: 'reject',
        reason: rejectionReason,
      });
    } else {
      policyResults.push({
        candidateId: link.candidateId,
        decision: 'accept',
        reason: 'policy_accepted',
      });
      acceptedRelationshipKeys.add(relationshipKey(link));
    }
  }

  return { policyResults };
}

export function buildLinkTrace(input: {
  acceptedLinks: ReviewedLink[];
  appliedLinks: ReviewedLink[];
  candidates: LinkCandidate[];
  extraction: IngestionAgentOutput;
  policyResults: Array<{ candidateId: string; decision: 'accept' | 'reject'; reason: string }>;
  rejectedLinks: ReviewedLink[];
  reviewedLinks: ReviewedLink[];
}) {
  const acceptedLinks = input.acceptedLinks;
  const rejectedLinks = input.rejectedLinks;

  return {
    acceptedLinks,
    appliedLinks: input.appliedLinks,
    candidates: input.candidates,
    metrics: {
      acceptedCount: input.acceptedLinks.length,
      appliedCount: input.appliedLinks.length,
      averageAcceptedConfidence: input.acceptedLinks.length
        ? input.acceptedLinks.reduce((sum, l) => sum + l.confidence, 0) / input.acceptedLinks.length
        : 0,
      averageAcceptedEvidenceScore: input.acceptedLinks.length
        ? input.acceptedLinks.reduce((sum, l) => sum + l.evidenceQuality.finalEvidenceScore, 0) /
          input.acceptedLinks.length
        : 0,
      candidateCount: input.candidates.length,
      exactMatchCandidateCount: input.candidates.filter((c) => c.resolutionType === 'exact').length,
      missingDecisionCount: input.candidates.length - input.reviewedLinks.length,
      rejectedCount: input.rejectedLinks.length,
      relationClaimCount: input.extraction.relationClaims.length,
      reviewedCount: input.reviewedLinks.length,
      semanticCandidateCount: input.candidates.filter((c) => c.resolutionType === 'semantic').length,
      weakEvidenceCount: input.reviewedLinks.filter(
        (l) => l.evidenceQuality.evidenceStrength === 'weak'
      ).length,
    },
    policyResults: input.policyResults,
    relationClaims: input.extraction.relationClaims,
    rejectedLinks,
    reviewedLinks: input.reviewedLinks,
  };
}

export function applyAcceptedLinks(
  extraction: IngestionAgentOutput,
  acceptedLinks: ReviewedLink[]
): IngestionAgentOutput {
  if (!acceptedLinks.length) return extraction;

  const newRelationships: IngestionRelationship[] = acceptedLinks.map((link) => ({
    relationshipType: link.relationshipType,
    sourceConceptKey: link.sourceConceptKey,
    sourceRefs: [
      {
        blockId: link.evidence.blockId,
        locationLabel: link.evidence.locationLabel,
        quote: link.evidence.quote,
      },
    ],
    targetConceptKey: link.targetConceptKey,
  }));

  return {
    ...extraction,
    relationships: [...extraction.relationships, ...newRelationships],
  };
}

export function reviewLinksDeterministically(candidates: LinkCandidate[]): ReviewedLink[] {
  return candidates.map((candidate) => {
    const isSelfEdge = candidate.sourceConceptKey === candidate.targetConceptKey;
    const isHeading = candidate.evidence.locationLabel?.toLowerCase().includes('heading') && !candidate.evidence.quote.includes(' ');

    const relationshipTypeConfidence = isSelfEdge ? 0.1 : 0.9;
    const semanticSupportConfidence = isSelfEdge ? 0.1 : 0.9;
    const confidence = isSelfEdge || isHeading ? 0.5 : 0.9;
    
    const evidenceQuality = scoreLinkEvidence({
      quote: candidate.evidence.quote,
      relationshipType: candidate.relationshipType,
      relationshipTypeConfidence,
      semanticSupportConfidence,
    });

    const decision = confidence >= MIN_LINK_CONFIDENCE ? 'accept' : 'reject';

    return {
      ...candidate,
      confidence,
      decision,
      evidenceQuality,
      rationale: `Deterministic review: ${decision} (confidence=${confidence.toFixed(2)})`,
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
  if (!input.quote.trim()) {
    return rejectedEvidenceQuality('empty_quote');
  }

  const shape = scoreEvidenceShape(input.quote, input.relationshipType);
  const grounded = true;
  const groundingReason = 'exact_quote';
  let finalScore =
    (input.semanticSupportConfidence * 0.4 +
      input.relationshipTypeConfidence * 0.3 +
      shape.shapeScore * 0.3) *
    (grounded ? 1 : 0.2);

  if (shape.evidenceKind === 'heading') {
    finalScore = Math.min(finalScore, 0.59);
  }

  return {
    evidenceKind: shape.evidenceKind,
    evidenceReason: shape.evidenceReason,
    evidenceStrength: evidenceStrengthForScore(finalScore),
    finalEvidenceScore: clampScore(finalScore),
    grounded,
    groundingReason,
    relationshipTypeConfidence: input.relationshipTypeConfidence,
    semanticSupportConfidence: input.semanticSupportConfidence,
    shapeScore: shape.shapeScore,
    suggestedRelationshipType: input.suggestedRelationshipType,
  };
}

// --- Private helpers ---

function relationshipTypeForPredicate(
  predicate: string
): KnowledgebaseRelationshipTypeDto {
  const normalized = predicate.toLowerCase().trim();
  if (['prerequisite', 'requires', 'depends_on', 'builds_on'].includes(normalized)) {
    return 'prerequisite';
  }
  if (['part_of', 'belongs_to', 'contains'].includes(normalized)) {
    return 'part_of';
  }
  if (['explains', 'describes', 'defines', 'clarifies'].includes(normalized)) {
    return 'explains';
  }
  return 'related_to';
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

function relationshipKey(
  relationship: Pick<
    IngestionRelationship,
    'relationshipType' | 'sourceConceptKey' | 'targetConceptKey'
  >
) {
  return `${relationship.sourceConceptKey}:${relationship.targetConceptKey}:${relationship.relationshipType}`;
}

function linkPolicyRejectionReason(
  link: ReviewedLink,
  existingRelationships: Set<string>,
  acceptedRelationships: Set<string>
) {
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

  if (link.decision === 'reject') {
    return 'agent_rejected';
  }

  return null;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function isExactConceptMatch(query: string, concept: { conceptKey: string; name: string }) {
  const normalizedQuery = normalizeText(query);

  return (
    normalizeText(concept.conceptKey) === normalizedQuery ||
    normalizeText(concept.name) === normalizedQuery
  );
}
