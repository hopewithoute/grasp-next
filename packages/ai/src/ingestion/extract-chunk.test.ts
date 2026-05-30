import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateAgainstBlocks } from './extract-chunk';
import type { IngestionAgentOutput } from '@grasp/domain';

describe('validateAgainstBlocks', () => {
  it('retains a concept whose quote remains grounded in at least one block', () => {
    const agentOutput: IngestionAgentOutput = {
      concepts: [
        {
          conceptKey: 'elasticity',
          name: 'Elasticity',
          definition: 'A responsiveness measure.',
          difficulty: 'beginner',
          confidence: 0.9,
          sourceRefs: [
            { blockId: 'blk-1', quote: 'Elasticity', locationLabel: 'heading' },
            { blockId: 'blk-2', quote: 'Price elasticity measures responsiveness of quantity demanded to price changes.', locationLabel: 'paragraph' },
          ],
        },
      ],
      relationClaims: [],
      relationships: [],
    };

    const blocks = [
      { id: 'blk-1', text: 'Elasticity' },
      { id: 'blk-2', text: 'Price elasticity measures responsiveness of quantity demanded to price changes.' },
    ];

    const result = validateAgainstBlocks(agentOutput, blocks);

    assert.equal(result.concepts.length, 1);
    assert.equal(result.concepts[0]?.conceptKey, 'elasticity');
    assert.ok(result.concepts[0]?.sourceRefs.length >= 1, 'expected at least one grounded ref');
    assert.deepEqual(result.droppedConceptKeys, []);
  });

  it('keeps paragraph relationship evidence while filtering weak heading-only refs', () => {
    const agentOutput: IngestionAgentOutput = {
      concepts: [
        {
          conceptKey: 'market-equilibrium',
          name: 'Market Equilibrium',
          definition: 'Equilibrium quantity and price.',
          difficulty: 'beginner',
          confidence: 0.9,
          sourceRefs: [
            { blockId: 'blk-2', quote: 'Supply and Demand establishes market equilibrium conditions.', locationLabel: 'paragraph' },
          ],
        },
        {
          conceptKey: 'law-of-demand',
          name: 'Law of Demand',
          definition: 'Demand curve relationship.',
          difficulty: 'beginner',
          confidence: 0.9,
          sourceRefs: [
            { blockId: 'blk-2', quote: 'Supply and Demand establishes market equilibrium conditions.', locationLabel: 'paragraph' },
          ],
        },
      ],
      relationClaims: [],
      relationships: [
        {
          sourceConceptKey: 'market-equilibrium',
          targetConceptKey: 'law-of-demand',
          relationshipType: 'prerequisite',
          rationale: 'market equilibrium depends on demand relationships',
          sourceRefs: [
            { blockId: 'blk-1', quote: 'Supply and Demand', locationLabel: 'heading' },
            { blockId: 'blk-2', quote: 'Supply and Demand establishes market equilibrium conditions.', locationLabel: 'paragraph' },
          ],
        },
      ],
    };

    const blocks = [
      { id: 'blk-1', text: 'Supply and Demand' },
      { blockId: 'blk-2', text: 'Supply and Demand establishes market equilibrium conditions.' } as unknown as { id: string; text: string },
    ];

    const result = validateAgainstBlocks(agentOutput, blocks);

    assert.equal(result.relationships.length, 1);
    const keptQuotes = result.relationships[0]?.sourceRefs.map((ref) => ref.quote) ?? [];
    assert.ok(
      keptQuotes.every((quote) => quote !== 'Supply and Demand'),
      'expected heading-only weak evidence to be filtered'
    );
    assert.ok(
      keptQuotes.some((quote) => quote === 'Supply and Demand establishes market equilibrium conditions.'),
      'expected paragraph evidence to be retained'
    );
    assert.ok(result.droppedRefCount >= 1, `expected droppedRefCount >= 1, got ${result.droppedRefCount}`);
  });
});
