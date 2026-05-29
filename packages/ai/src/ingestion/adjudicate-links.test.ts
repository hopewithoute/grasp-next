import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LinkCandidate } from './linking';
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

    assert.equal(result.links.length, 1);
    assert.equal(result.links[0]?.candidateId, candidate.candidateId);
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

    assert.equal(result.links[0]?.sourceConceptKey, candidate.sourceConceptKey);
    assert.equal(result.links[0]?.targetConceptKey, candidate.targetConceptKey);
    assert.equal(result.links[0]?.relationshipType, candidate.relationshipType);
    assert.deepEqual(result.links[0]?.evidence, candidate.evidence);
    assert.equal(result.links[0]?.decision, 'accept');
    assert.equal(result.links[0]?.confidence, 0.9);
    assert.equal(result.links[0]?.evidenceQuality.semanticSupportConfidence, 0.9);
    assert.equal(result.links[0]?.evidenceQuality.relationshipTypeConfidence, 0.88);
  });

  it('fails when a candidate decision is missing', () => {
    assert.throws(
      () => parseReviewedLinkList({ links: [] }, [candidate]),
      /link_adjudicator_incomplete/
    );
  });

  it('fails when the model returns an unknown candidate', () => {
    assert.throws(
      () =>
        parseReviewedLinkList({ links: [{ ...reviewed, candidateId: 'candidate:unknown' }] }, [
          candidate,
        ]),
      /link_adjudicator_unknown_candidate/
    );
  });

  it('fails when the model returns duplicate candidate decisions', () => {
    assert.throws(
      () => parseReviewedLinkList({ links: [reviewed, reviewed] }, [candidate]),
      /link_adjudicator_duplicate_candidate/
    );
  });
});
