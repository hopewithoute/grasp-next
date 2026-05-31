import { describe, expect, it } from 'vitest';
import type { LinkCandidate } from '@grasp/domain';
import { parseReviewedLinkList } from './adjudicate-links';

describe('parseReviewedLinkList', () => {
  const candidate: LinkCandidate = {
    candidateId: 'candidate:supply-and-demand:elasticity:prerequisite',
    evidence: {
      blockId: 'block-0001',
      locationLabel: 'Elasticity / Block 1',
      quote: 'It builds on supply and demand.',
    },
    reason: 'Resolved supply and demand to an existing concept.',
    relationshipType: 'prerequisite',
    resolutionType: 'exact',
    sourceConceptKey: 'supply-and-demand',
    sourceConceptName: 'Supply and Demand',
    targetConceptKey: 'elasticity',
    targetConceptName: 'Elasticity',
    type: 'add_relationship',
  };
  const reviewed = {
    candidateId: candidate.candidateId,
    decision: 'accept' as const,
    relationshipTypeConfidence: 0.88,
    rationale: 'The source directly states the prerequisite.',
    semanticSupportConfidence: 0.9,
  };

  it('requires exactly one valid decision per candidate', () => {
    const result = parseReviewedLinkList({ links: [reviewed] }, [candidate]);

    expect(result.links.length).toBe(1);
    expect(result.links[0]?.candidateId).toBe(candidate.candidateId);
  });

  it('keeps edge fields anchored to the generated candidate', () => {
    const result = parseReviewedLinkList(
      {
        links: [
          {
            ...reviewed,
            rationale: 'Something else',
          },
        ],
      },
      [candidate]
    );

    expect(result.links[0]?.sourceConceptKey).toBe(candidate.sourceConceptKey);
    expect(result.links[0]?.targetConceptKey).toBe(candidate.targetConceptKey);
    expect(result.links[0]?.relationshipType).toBe(candidate.relationshipType);
    expect(result.links[0]?.evidence).toEqual(candidate.evidence);
    expect(result.links[0]?.decision).toBe('accept');
    expect(result.links[0]?.confidence).toBe(0.9);
    expect(result.links[0]?.evidenceQuality.semanticSupportConfidence).toBe(0.9);
    expect(result.links[0]?.evidenceQuality.relationshipTypeConfidence).toBe(0.88);
  });

  it('fails when a candidate decision is missing', () => {
    expect(() => parseReviewedLinkList({ links: [] }, [candidate])).toThrow(
      /link_adjudicator_incomplete/
    );
  });

  it('fails when the model returns an unknown candidate', () => {
    expect(() =>
        parseReviewedLinkList({ links: [{ ...reviewed, candidateId: 'candidate:unknown' }] }, [
          candidate,
        ])
    ).toThrow(/link_adjudicator_unknown_candidate/);
  });

  it('fails when the model returns duplicate candidate decisions', () => {
    expect(() => parseReviewedLinkList({ links: [reviewed, reviewed] }, [candidate])).toThrow(
      /link_adjudicator_duplicate_candidate/
    );
  });
});
