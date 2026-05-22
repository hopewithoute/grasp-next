import { getGeneratedText, parseLooseJsonResponse } from './response-helpers';
import {
  reviewLinksDeterministically,
  linkCandidateDto,
  scoreLinkEvidence,
  type LinkCandidate,
  type ReviewedLink,
} from './linking';
import { linkAdjudicatorAgent } from './link-adjudicator-agent';
import { canUseAgentModel } from '../model-resolver';
import { z } from 'zod';

export async function adjudicateLinks(input: {
  candidates: LinkCandidate[];
  useModel?: boolean;
}): Promise<ReviewedLink[]> {
  if (!input.candidates.length) {
    return [];
  }

  if (input.useModel === false || !canUseAgentModel('ingestionAgent', process.env)) {
    return reviewLinksDeterministically(input.candidates);
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await linkAdjudicatorAgent.generate(
        buildReviewPrompt(input.candidates, attempt)
      );
      const parsed = parseLooseJsonResponse(getGeneratedText(response));
      const result = parseReviewedLinkList(parsed, input.candidates);

      return result.links;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function parseReviewedLinkList(
  value: unknown,
  candidates: LinkCandidate[]
) {
  const record = value as { links?: unknown };
  if (!Array.isArray(record?.links)) {
    throw new Error('link_adjudicator_invalid_json');
  }

  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  const seenCandidateIds = new Set<string>();
  const links: ReviewedLink[] = [];

  for (const link of record.links) {
    const parsed = linkDecisionDto.safeParse(link);

    if (!parsed.success) {
      throw new Error('link_adjudicator_invalid_decision');
    }

    const candidate = candidatesById.get(parsed.data.candidateId);
    if (!candidate) {
      throw new Error('link_adjudicator_unknown_candidate');
    }

    if (seenCandidateIds.has(parsed.data.candidateId)) {
      throw new Error('link_adjudicator_duplicate_candidate');
    }

    seenCandidateIds.add(parsed.data.candidateId);
    links.push({
      ...candidate,
      confidence: parsed.data.semanticSupportConfidence,
      decision: parsed.data.decision,
      evidenceQuality: scoreLinkEvidence({
        quote: candidate.evidence.quote,
        relationshipType: candidate.relationshipType,
        relationshipTypeConfidence: parsed.data.relationshipTypeConfidence,
        semanticSupportConfidence: parsed.data.semanticSupportConfidence,
        suggestedRelationshipType: parsed.data.suggestedRelationshipType,
      }),
      rationale: parsed.data.rationale,
    });
  }

  if (seenCandidateIds.size !== candidatesById.size) {
    throw new Error('link_adjudicator_incomplete');
  }

  return { links };
}

const linkDecisionDto = z
  .object({
    candidateId: z.string().trim().min(1),
    confidence: z.number().min(0).max(1).optional(),
    decision: z.enum(['accept', 'reject']),
    relationshipTypeConfidence: z.number().min(0).max(1).optional(),
    rationale: z.string().trim().min(1),
    semanticSupportConfidence: z.number().min(0).max(1).optional(),
    suggestedRelationshipType: z
      .enum(['prerequisite', 'part_of', 'related_to', 'explains'])
      .optional(),
  })
  .transform((decision) => {
    const fallbackConfidence = decision.confidence ?? 0;

    return {
      ...decision,
      relationshipTypeConfidence:
        decision.relationshipTypeConfidence ?? fallbackConfidence,
      semanticSupportConfidence:
        decision.semanticSupportConfidence ?? fallbackConfidence,
    };
  })
  .refine(
    (decision) =>
      decision.relationshipTypeConfidence > 0 && decision.semanticSupportConfidence > 0,
    'semanticSupportConfidence and relationshipTypeConfidence are required'
  );

function buildReviewPrompt(candidates: LinkCandidate[], attempt = 0) {
  const compactCandidates = candidates.map((candidate) =>
    linkCandidateDto.parse(candidate)
  );

  return `Review these link candidates.

${attempt > 0 ? 'Previous response failed validation. Return one valid link decision for every candidateId and no extra candidateIds.' : ''}

Return only JSON:
{
  "links": [
    {
      "rationale": string,
      "candidateId": string,
      "decision": "accept" | "reject",
      "semanticSupportConfidence": number,
      "relationshipTypeConfidence": number,
      "suggestedRelationshipType": "prerequisite" | "part_of" | "related_to" | "explains"
    }
  ]
}

Candidates:
${JSON.stringify(compactCandidates)}`;
}
