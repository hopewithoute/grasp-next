import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sourceLinkingWorkflow } from './source-linking-workflow';

describe('sourceLinkingWorkflow', () => {
  it('reviews link candidates through the Mastra workflow', async () => {
    const run = await sourceLinkingWorkflow.createRun();
    const result = await run.start({
      inputData: {
        candidates: [
          {
            candidateId: 'candidate:supply-and-demand:elasticity:prerequisite',
            evidence: {
              blockId: 'block-0001',
              locationLabel: 'Elasticity / Block 1',
              quote: 'It builds on the foundational concepts of supply and demand.',
            },
            reason:
              'Relation claim "Elasticity builds_on supply and demand" resolved "supply and demand" to existing concept "Supply and Demand".',
            relationshipType: 'prerequisite',
            resolutionType: 'exact',
            sourceConceptKey: 'supply-and-demand',
            sourceConceptName: 'Supply and Demand',
            targetConceptKey: 'elasticity',
            targetConceptName: 'Elasticity',
            type: 'add_relationship',
          },
        ],
        extraction: {
          concepts: [
            {
              conceptKey: 'elasticity',
              confidence: 0.9,
              definition: 'Elasticity measures sensitivity to change.',
              difficulty: 'intermediate',
              mergesWith: undefined,
              name: 'Elasticity',
              sourceRefs: [
                {
                  blockId: 'block-0001',
                  locationLabel: 'Elasticity / Block 1',
                  quote: 'It builds on the foundational concepts of supply and demand.',
                },
              ],
            },
          ],
          relationClaims: [],
          relationships: [],
        },
        useModel: false,
      },
    });

    assert.equal(result.status, 'success');
    assert.equal(result.result?.reviewedLinks.length, 1);
    assert.equal(result.result?.acceptedLinks.length, 1);
    assert.equal(result.result?.policyResults.length, 1);
    assert.equal(result.result?.trace.metrics.candidateCount, 1);
    assert.equal(result.result?.trace.metrics.acceptedCount, 1);
    assert.equal(result.result?.trace.metrics.appliedCount, 1);
    assert.equal(result.result?.patchedExtraction.relationships.length, 1);
  });

  it('applies deterministic policy before linking relationships into the extraction', async () => {
    const run = await sourceLinkingWorkflow.createRun();
    const result = await run.start({
      inputData: {
        candidates: [
          {
            candidateId: 'candidate:elasticity:elasticity:prerequisite',
            evidence: {
              blockId: 'block-0001',
              locationLabel: 'Elasticity / Block 1',
              quote: 'Elasticity builds on elasticity.',
            },
            reason: 'Self-edge candidate should not be applied.',
            relationshipType: 'prerequisite',
            resolutionType: 'exact',
            sourceConceptKey: 'elasticity',
            sourceConceptName: 'Elasticity',
            targetConceptKey: 'elasticity',
            targetConceptName: 'Elasticity',
            type: 'add_relationship',
          },
        ],
        extraction: {
          concepts: [
            {
              conceptKey: 'elasticity',
              confidence: 0.9,
              definition: 'Elasticity measures sensitivity to change.',
              difficulty: 'intermediate',
              mergesWith: undefined,
              name: 'Elasticity',
              sourceRefs: [
                {
                  blockId: 'block-0001',
                  locationLabel: 'Elasticity / Block 1',
                  quote: 'Elasticity builds on elasticity.',
                },
              ],
            },
          ],
          relationClaims: [],
          relationships: [],
        },
        useModel: false,
      },
    });

    assert.equal(result.status, 'success');
    assert.equal(result.result?.acceptedLinks.length, 0);
    assert.equal(result.result?.rejectedLinks.length, 1);
    assert.equal(result.result?.policyResults[0]?.reason, 'self_edge');
    assert.equal(result.result?.patchedExtraction.relationships.length, 0);
  });

  it('rejects heading-only link evidence before patching graph relationships', async () => {
    const run = await sourceLinkingWorkflow.createRun();
    const result = await run.start({
      inputData: {
        candidates: [
          {
            candidateId: 'candidate:supply-and-demand:elasticity:prerequisite',
            evidence: {
              blockId: 'block-0001',
              locationLabel: 'Elasticity / Heading',
              quote: 'Elasticity',
            },
            reason: 'Heading-only evidence should not ground a relationship.',
            relationshipType: 'prerequisite',
            resolutionType: 'exact',
            sourceConceptKey: 'supply-and-demand',
            sourceConceptName: 'Supply and Demand',
            targetConceptKey: 'elasticity',
            targetConceptName: 'Elasticity',
            type: 'add_relationship',
          },
        ],
        extraction: {
          concepts: [
            {
              conceptKey: 'elasticity',
              confidence: 0.9,
              definition: 'Elasticity measures sensitivity to change.',
              difficulty: 'intermediate',
              mergesWith: undefined,
              name: 'Elasticity',
              sourceRefs: [
                {
                  blockId: 'block-0001',
                  locationLabel: 'Elasticity / Heading',
                  quote: 'Elasticity',
                },
              ],
            },
          ],
          relationClaims: [],
          relationships: [],
        },
        useModel: false,
      },
    });

    assert.equal(result.status, 'success');
    assert.equal(result.result?.acceptedLinks.length, 0);
    assert.equal(result.result?.rejectedLinks.length, 1);
    assert.equal(result.result?.policyResults[0]?.reason, 'confidence_below_threshold');
    assert.equal(result.result?.trace.metrics.weakEvidenceCount, 1);
    assert.equal(result.result?.patchedExtraction.relationships.length, 0);
  });
});
