import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeDraft, normalizeAgentOutput, validateAgainstBlocks } from './extract-chunk';

describe('normalizeAgentOutput', () => {
  it('drops unsupported relationship types before schema validation', () => {
    const normalized = normalizeAgentOutput({
      concepts: [],
      relationships: [
        { relationshipType: 'prerequisite', sourceConceptKey: 'a', targetConceptKey: 'b' },
        { relationshipType: 'related_to', sourceConceptKey: 'a', targetConceptKey: 'c' },
        { relationshipType: 'part_of', sourceConceptKey: 'a', targetConceptKey: 'd' },
        { relationshipType: 'supports', sourceConceptKey: 'a', targetConceptKey: 'e' },
      ],
    }) as { relationships: Array<{ relationshipType: string }> };

    assert.deepEqual(
      normalized.relationships.map((relationship) => relationship.relationshipType),
      ['prerequisite', 'related_to', 'part_of']
    );
  });
});

describe('mergeDraft', () => {
  it('deduplicates relationships by source, target, and type', () => {
    const merged = mergeDraft(
      {
        concepts: [
          {
            conceptKey: 'market',
            confidence: 0.9,
            definition: 'A place of exchange.',
            difficulty: 'beginner',
            mergesWith: undefined,
            name: 'Market',
            sourceRefs: [{ blockId: 'block-1', locationLabel: 'Block 1', quote: 'market' }],
          },
        ],
        relationClaims: [],
        relationships: [
          {
            relationshipType: 'prerequisite',
            sourceConceptKey: 'market',
            sourceRefs: [{ blockId: 'block-1', locationLabel: 'Block 1', quote: 'market' }],
            targetConceptKey: 'equilibrium',
          },
        ],
      },
      {
        concepts: [],
        relationClaims: [],
        relationships: [
          {
            relationshipType: 'prerequisite',
            sourceConceptKey: 'market',
            sourceRefs: [{ blockId: 'block-1', locationLabel: 'Block 1', quote: 'market' }],
            targetConceptKey: 'equilibrium',
          },
        ],
      }
    );

    assert.equal(merged.relationships.length, 1);
  });
});

describe('validateAgainstBlocks', () => {
  it('drops relationship refs that are only heading evidence', () => {
    const result = validateAgainstBlocks(
      {
        concepts: [
          {
            conceptKey: 'law-of-demand',
            confidence: 0.9,
            definition: 'Demand falls when price rises.',
            difficulty: 'beginner',
            mergesWith: undefined,
            name: 'Law of Demand',
            sourceRefs: [
              {
                blockId: 'block-1',
                locationLabel: 'Heading',
                quote: 'Law of Demand',
              },
            ],
          },
          {
            conceptKey: 'supply-and-demand',
            confidence: 0.9,
            definition: 'Markets coordinate supply and demand.',
            difficulty: 'beginner',
            mergesWith: undefined,
            name: 'Supply and Demand',
            sourceRefs: [
              {
                blockId: 'block-2',
                locationLabel: 'Paragraph',
                quote:
                  'As the price of a good increases, the quantity demanded decreases, all else being equal.',
              },
            ],
          },
        ],
        relationClaims: [],
        relationships: [
          {
            relationshipType: 'part_of',
            sourceConceptKey: 'law-of-demand',
            sourceRefs: [
              {
                blockId: 'block-1',
                locationLabel: 'Heading',
                quote: 'Law of Demand',
              },
            ],
            targetConceptKey: 'supply-and-demand',
          },
        ],
      },
      [
        { id: 'block-1', text: 'Law of Demand' },
        {
          id: 'block-2',
          text:
            'As the price of a good increases, the quantity demanded decreases, all else being equal.',
        },
      ]
    );

    assert.equal(result.relationships.length, 0);
    assert.equal(result.droppedRefCount, 1);
  });

  it('keeps paragraph evidence for relationships even when heading refs are present', () => {
    const result = validateAgainstBlocks(
      {
        concepts: [
          {
            conceptKey: 'law-of-demand',
            confidence: 0.9,
            definition: 'Demand falls when price rises.',
            difficulty: 'beginner',
            mergesWith: undefined,
            name: 'Law of Demand',
            sourceRefs: [
              {
                blockId: 'block-1',
                locationLabel: 'Heading',
                quote: 'Law of Demand',
              },
            ],
          },
          {
            conceptKey: 'supply-and-demand',
            confidence: 0.9,
            definition: 'Markets coordinate supply and demand.',
            difficulty: 'beginner',
            mergesWith: undefined,
            name: 'Supply and Demand',
            sourceRefs: [
              {
                blockId: 'block-2',
                locationLabel: 'Paragraph',
                quote:
                  'As the price of a good increases, the quantity demanded decreases, all else being equal.',
              },
            ],
          },
        ],
        relationClaims: [],
        relationships: [
          {
            relationshipType: 'part_of',
            sourceConceptKey: 'law-of-demand',
            sourceRefs: [
              {
                blockId: 'block-1',
                locationLabel: 'Heading',
                quote: 'Law of Demand',
              },
              {
                blockId: 'block-2',
                locationLabel: 'Paragraph',
                quote:
                  'As the price of a good increases, the quantity demanded decreases, all else being equal.',
              },
            ],
            targetConceptKey: 'supply-and-demand',
          },
        ],
      },
      [
        { id: 'block-1', text: 'Law of Demand' },
        {
          id: 'block-2',
          text:
            'As the price of a good increases, the quantity demanded decreases, all else being equal.',
        },
      ]
    );

    assert.equal(result.relationships.length, 1);
    assert.equal(result.relationships[0]?.sourceRefs.length, 1);
    assert.equal(result.relationships[0]?.sourceRefs[0]?.blockId, 'block-2');
    assert.equal(result.relationships[0]?.evidenceQuality?.evidenceStrength, 'usable');
    assert.ok((result.relationships[0]?.evidenceQuality?.finalEvidenceScore ?? 0) >= 0.6);
  });
});
