import {
  confidenceScore,
  linkCandidateDto,
  parse,
  RELATIONSHIP_TYPES,
  requiredString,
  reviewLinksDeterministically,
  safeParse,
  scoreLinkEvidence,
  v,
  type LinkCandidate,
  type ReviewedLink,
} from '@grasp/domain';
import { PromptTemplate } from '../utils/prompt-template';
import { linkAdjudicatorAgent } from './link-adjudicator.agent';

export async function adjudicateLinks(input: {
  candidates: LinkCandidate[];
  useModel?: boolean;
}): Promise<ReviewedLink[]> {
  if (!input.candidates.length) {
    return [];
  }

  if (input.useModel === false) {
    return reviewLinksDeterministically(input.candidates);
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await linkAdjudicatorAgent.generate(
        buildReviewPrompt(input.candidates, attempt),
        { structuredOutput: { schema: linkDecisionListDto } }
      );
      const result = parseReviewedLinkList(response.object, input.candidates);

      return result.links;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function parseReviewedLinkList(record: unknown, candidates: LinkCandidate[]) {
  const parsedRecord = parseLinkDecisionList(record);
  const candidatesById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const seenCandidateIds = new Set<string>();
  const links: ReviewedLink[] = [];

  for (const parsed of parsedRecord.links) {
    const candidate = candidatesById.get(parsed.candidateId);
    if (!candidate) {
      throw new Error('link_adjudicator_unknown_candidate');
    }

    if (seenCandidateIds.has(parsed.candidateId)) {
      throw new Error('link_adjudicator_duplicate_candidate');
    }

    seenCandidateIds.add(parsed.candidateId);
    links.push({
      ...candidate,
      confidence: parsed.semanticSupportConfidence,
      decision: parsed.decision,
      evidenceQuality: scoreLinkEvidence({
        quote: candidate.evidence.quote,
        relationshipType: candidate.relationshipType,
        relationshipTypeConfidence: parsed.relationshipTypeConfidence,
        semanticSupportConfidence: parsed.semanticSupportConfidence,
        suggestedRelationshipType: parsed.suggestedRelationshipType,
      }),
      rationale: parsed.rationale,
    });
  }

  if (seenCandidateIds.size !== candidatesById.size) {
    throw new Error('link_adjudicator_incomplete');
  }

  return { links };
}

const linkDecisionDto = v.object({
  candidateId: requiredString,
  confidence: v.optional(confidenceScore),
  decision: v.picklist(['accept', 'reject']),
  relationshipTypeConfidence: v.optional(confidenceScore),
  rationale: requiredString,
  semanticSupportConfidence: v.optional(confidenceScore),
  suggestedRelationshipType: v.optional(v.picklist(RELATIONSHIP_TYPES)),
});

const linkDecisionListDto = v.object({
  links: v.array(linkDecisionDto),
});

type LinkDecision = v.InferOutput<typeof linkDecisionDto>;
type NormalizedLinkDecision = LinkDecision & {
  relationshipTypeConfidence: number;
  semanticSupportConfidence: number;
};

function parseLinkDecisionList(record: unknown): { links: NormalizedLinkDecision[] } {
  const parsed = safeParse(linkDecisionListDto, record);

  if (!parsed.success) {
    throw new Error(`link_adjudicator_schema_invalid: ${v.summarize(parsed.issues)}`);
  }

  return {
    links: parsed.output.links.map(normalizeLinkDecision),
  };
}

function normalizeLinkDecision(decision: LinkDecision): NormalizedLinkDecision {
  const fallbackConfidence = decision.confidence ?? 0;
  const relationshipTypeConfidence = decision.relationshipTypeConfidence ?? fallbackConfidence;
  const semanticSupportConfidence = decision.semanticSupportConfidence ?? fallbackConfidence;
  const candidateId = decision.candidateId.trim();
  const rationale = decision.rationale.trim();

  if (!candidateId || !rationale) {
    throw new Error('link_adjudicator_schema_invalid: candidateId and rationale are required');
  }

  return {
    ...decision,
    candidateId,
    rationale,
    relationshipTypeConfidence,
    semanticSupportConfidence,
  };
}

type LinkReviewPromptVars = {
  retryInstructions: string;
  candidatesJson: string;
};

const LINK_REVIEW_PROMPT = new PromptTemplate<LinkReviewPromptVars>(`Review these link candidates.

{{retryInstructions}}Candidates:
{{candidatesJson}}`);

function buildReviewPrompt(candidates: LinkCandidate[], attempt = 0) {
  const compactCandidates = candidates.map((candidate) => parse(linkCandidateDto, candidate));
  const retryInstructions =
    attempt > 0
      ? 'Previous response failed validation. Return one valid link decision for every candidateId and no extra candidateIds.\n\n'
      : '';

  return LINK_REVIEW_PROMPT.format({
    retryInstructions,
    candidatesJson: JSON.stringify(compactCandidates),
  });
}
