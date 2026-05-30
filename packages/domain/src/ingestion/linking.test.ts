import { describe, expect, it } from 'vitest';
import type { IngestionAgentOutput } from '../index';
import { buildLinkCandidates, scoreLinkEvidence } from './linking';

describe('scoreLinkEvidence', () => {
  it('caps heading-only evidence below the usable threshold', () => {
    const quality = scoreLinkEvidence({
      quote: 'Law of Demand',
      relationshipType: 'prerequisite',
      relationshipTypeConfidence: 0.95,
      semanticSupportConfidence: 0.95,
    });

    expect(quality.evidenceKind).toBe('heading');
    expect(quality.evidenceStrength).toBe('weak');
    expect(quality.finalEvidenceScore < 0.6).toBeTruthy();
  });
});

describe('buildLinkCandidates', () => {
  const cases = [
    {
      existingConceptKey: 'supply-and-demand',
      existingConceptName: 'Supply and Demand',
      objectText: 'supply and demand',
      subjectConceptKey: 'elasticity',
      subjectConceptName: 'Elasticity',
    },
    {
      existingConceptKey: 'force',
      existingConceptName: 'Force',
      objectText: 'force',
      subjectConceptKey: 'acceleration',
      subjectConceptName: 'Acceleration',
    },
    {
      existingConceptKey: 'cell-membrane',
      existingConceptName: 'Cell Membrane',
      objectText: 'cell membrane',
      subjectConceptKey: 'osmosis',
      subjectConceptName: 'Osmosis',
    },
    {
      existingConceptKey: 'variables',
      existingConceptName: 'Variables',
      objectText: 'variables',
      subjectConceptKey: 'functions',
      subjectConceptName: 'Functions',
    },
  ];

  for (const fixture of cases) {
    it(`links ${fixture.existingConceptKey} -> ${fixture.subjectConceptKey}`, async () => {
      const extraction: IngestionAgentOutput = {
        concepts: [
          {
            conceptKey: fixture.subjectConceptKey,
            confidence: 0.9,
            definition: `${fixture.subjectConceptName} depends on prior concepts.`,
            difficulty: 'intermediate',
            mergesWith: undefined,
            name: fixture.subjectConceptName,
            sourceRefs: [
              {
                blockId: 'block-0001',
                locationLabel: `${fixture.subjectConceptName} / Block 1`,
                quote: `${fixture.subjectConceptName} builds on ${fixture.objectText}.`,
              },
            ],
          },
        ],
        relationClaims: [
          {
            objectText: fixture.objectText,
            predicate: 'builds_on',
            sourceRefs: [
              {
                blockId: 'block-0001',
                locationLabel: `${fixture.subjectConceptName} / Block 1`,
                quote: `${fixture.subjectConceptName} builds on ${fixture.objectText}.`,
              },
            ],
            subjectText: fixture.subjectConceptName,
          },
        ],
        relationships: [],
      };

      const candidates = await buildLinkCandidates({
        getConceptContext: async () => null,
        localExtraction: extraction,
        searchConcepts: async ({ query }) =>
          query === fixture.objectText
            ? [
                {
                  conceptKey: fixture.existingConceptKey,
                  definition: `${fixture.existingConceptName} is already in the graph.`,
                  name: fixture.existingConceptName,
                },
              ]
            : [],
      });

      expect(candidates.length).toBe(1);
      expect(candidates[0]?.sourceConceptKey).toBe(fixture.existingConceptKey);
      expect(candidates[0]?.targetConceptKey).toBe(fixture.subjectConceptKey);
      expect(candidates[0]?.relationshipType).toBe('prerequisite');
      expect(candidates[0]?.resolutionType).toBe('exact');
    });
  }

  it('still links when the object is also extracted as a local concept', async () => {
    const extraction: IngestionAgentOutput = {
      concepts: [
        {
          conceptKey: 'total-revenue-and-elasticity',
          confidence: 0.9,
          definition: 'Total revenue analysis depends on elasticity.',
          difficulty: 'intermediate',
          mergesWith: undefined,
          name: 'Total Revenue and Elasticity',
          sourceRefs: [
            {
              blockId: 'block-0001',
              locationLabel: 'Total Revenue / Block 1',
              quote: 'It builds on the foundational concepts of price elasticity of demand.',
            },
          ],
        },
        {
          conceptKey: 'price-elasticity-of-demand',
          confidence: 0.85,
          definition: 'A repeated mention of an existing concept.',
          difficulty: 'intermediate',
          mergesWith: undefined,
          name: 'Price Elasticity of Demand',
          sourceRefs: [
            {
              blockId: 'block-0001',
              locationLabel: 'Total Revenue / Block 1',
              quote: 'It builds on the foundational concepts of price elasticity of demand.',
            },
          ],
        },
      ],
      relationClaims: [
        {
          objectText: 'price elasticity of demand',
          predicate: 'builds_on',
          sourceRefs: [
            {
              blockId: 'block-0001',
              locationLabel: 'Total Revenue / Block 1',
              quote: 'It builds on the foundational concepts of price elasticity of demand.',
            },
          ],
          subjectText: 'Total Revenue',
        },
      ],
      relationships: [],
    };

    const candidates = await buildLinkCandidates({
      getConceptContext: async () => null,
      localExtraction: extraction,
      searchConcepts: async ({ query }) =>
        query === 'price elasticity of demand'
          ? [
              {
                conceptKey: 'price-elasticity-of-demand',
                definition: 'Existing graph concept from the elasticity source.',
                name: 'Price Elasticity of Demand',
              },
            ]
          : [],
    });

    expect(candidates.length).toBe(1);
    expect(candidates[0]?.sourceConceptKey).toBe('price-elasticity-of-demand');
    expect(candidates[0]?.targetConceptKey).toBe('total-revenue-and-elasticity');
    expect(candidates[0]?.relationshipType).toBe('prerequisite');
  });
});
