import {
  reviewLinksDeterministically,
  linkCandidateDto,
  scoreLinkEvidence,
  type LinkCandidate,
  type ReviewedLink,
} from '@grasp/domain';
import { linkAdjudicatorAgent } from './link-adjudicator-agent';

import { z } from 'zod';

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
        { structuredOutput: { schema: z.object({ links: z.array(linkDecisionDto) }) } }
      );
      const result = parseReviewedLinkList(
        response.object as { links: Array<z.infer<typeof linkDecisionDto>> },
        input.candidates
      );

      return result.links;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function parseReviewedLinkList(
  record: { links: Array<z.infer<typeof linkDecisionDto>> },
  candidates: LinkCandidate[]
) {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const seenCandidateIds = new Set<string>();
  const links: ReviewedLink[] = [];

  for (const parsed of record.links) {
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
      relationshipTypeConfidence: decision.relationshipTypeConfidence ?? fallbackConfidence,
      semanticSupportConfidence: decision.semanticSupportConfidence ?? fallbackConfidence,
    };
  })
  .refine(
    (decision) => decision.relationshipTypeConfidence > 0 && decision.semanticSupportConfidence > 0,
    'semanticSupportConfidence and relationshipTypeConfidence are required'
  );

import { PromptTemplate } from '../utils/prompt-template';

type LinkReviewPromptVars = {
  retryInstructions: string;
  candidatesJson: string;
};

const LINK_REVIEW_PROMPT = new PromptTemplate<LinkReviewPromptVars>(`Review these link candidates.

{{retryInstructions}}Return only JSON:
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
{{candidatesJson}}`);

function buildReviewPrompt(candidates: LinkCandidate[], attempt = 0) {
  const compactCandidates = candidates.map((candidate) => linkCandidateDto.parse(candidate));
  const retryInstructions = attempt > 0 ? 'Previous response failed validation. Return one valid link decision for every candidateId and no extra candidateIds.\n\n' : '';

  return LINK_REVIEW_PROMPT.format({
    retryInstructions,
    candidatesJson: JSON.stringify(compactCandidates),
  });
}
