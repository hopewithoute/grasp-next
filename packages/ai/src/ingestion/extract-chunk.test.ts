import { describe, expect, it } from 'vitest';
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

    expect(result.concepts.length).toBe(1);
    expect(result.concepts[0]?.conceptKey).toBe('elasticity');
    expect(result.concepts[0]?.sourceRefs.length >= 1).toBeTruthy();
    expect(result.droppedConceptKeys).toEqual([]);
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

    expect(result.relationships.length).toBe(1);
    const keptQuotes = result.relationships[0]?.sourceRefs.map((ref) => ref.quote) ?? [];
    expect(keptQuotes.every((quote) => quote !== 'Supply and Demand')).toBeTruthy();
    expect(keptQuotes.some((quote) => quote === 'Supply and Demand establishes market equilibrium conditions.')).toBeTruthy();
    expect(result.droppedRefCount >= 1).toBeTruthy();
  });
});
