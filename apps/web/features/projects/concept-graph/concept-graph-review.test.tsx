import { describe, expect, it } from 'vitest';
import { buildConceptGraph, getEvidence, shortenBlockId } from './concept-graph-utils';
import { type ConceptRow, type RelationshipRow } from './types';

const concepts: ConceptRow[] = [
  {
    confidence: '0.92',
    definition: 'Force changes motion.',
    difficulty: 'beginner',
    id: 'c1',
    name: 'Force',
    sourceEvidence: [
      {
        blockId: 'source-1:block-0001',
        excerpt: 'Force changes motion.',
        location: 'excerpt 1',
        sourceId: 'source-1',
      },
    ],
  },
  {
    confidence: '0.81',
    definition: 'Acceleration is the rate of change of velocity.',
    difficulty: 'intermediate',
    id: 'c2',
    name: 'Acceleration',
    sourceEvidence: [
      {
        excerpt: 'Acceleration is the rate of change of velocity.',
        location: 'excerpt 2',
        blockId: 'source-1:block-0002',
        sourceId: 'source-1',
      },
    ],
  },
];

const relationships: RelationshipRow[] = [
  {
    id: 'r1',
    relationshipType: 'prerequisite',
    sourceEvidence: [
      {
        blockId: 'source-1:block-0002',
        excerpt: 'Acceleration is the rate of change of velocity.',
        location: 'excerpt 2',
        sourceId: 'source-1',
      },
    ],
    sourceConceptId: 'c1',
    targetConceptId: 'c2',
  },
];

describe('buildConceptGraph', () => {
  it('builds a graph layout that preserves prerequisite order', () => {
    const graph = buildConceptGraph(concepts, relationships);

    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.edges[0]?.source).toBe('c1');
    expect(graph.edges[0]?.target).toBe('c2');
    expect(graph.edges[0]?.type).toBe('step');
  });

  it('omits edges whose endpoint concepts are outside the rendered graph window', () => {
    const graph = buildConceptGraph([concepts[0]], relationships);

    expect(graph.nodes.length).toBe(1);
    expect(graph.edges.length).toBe(0);
  });

  it('uses the deepest prerequisite path when a concept has multiple parents', () => {
    const graph = buildConceptGraph(
      [
        ...concepts,
        {
          confidence: '0.7',
          definition: 'Velocity is speed with direction.',
          difficulty: 'beginner',
          id: 'c3',
          name: 'Velocity',
        },
        {
          confidence: '0.75',
          definition: 'Net force combines all forces.',
          difficulty: 'intermediate',
          id: 'c4',
          name: 'Net Force',
        },
      ],
      [
        ...relationships,
        {
          id: 'r2',
          relationshipType: 'prerequisite',
          sourceConceptId: 'c1',
          targetConceptId: 'c3',
        },
        {
          id: 'r3',
          relationshipType: 'prerequisite',
          sourceConceptId: 'c3',
          targetConceptId: 'c4',
        },
        {
          id: 'r4',
          relationshipType: 'prerequisite',
          sourceConceptId: 'c2',
          targetConceptId: 'c4',
        },
      ]
    );

    expect(graph.nodes.length).toBe(4);
    expect(graph.edges.length).toBe(4);

    const xByNodeId = new Map(graph.nodes.map((node) => [node.id, node.position.x]));
    expect((xByNodeId.get('c4') ?? 0) > (xByNodeId.get('c1') ?? 0)).toBeTruthy();
  });

  it('returns empty graph for no concepts', () => {
    const graph = buildConceptGraph([], []);
    expect(graph.nodes.length).toBe(0);
    expect(graph.edges.length).toBe(0);
  });

  it('handles single node with no edges', () => {
    const graph = buildConceptGraph([concepts[0]], []);
    expect(graph.nodes.length).toBe(1);
    expect(graph.edges.length).toBe(0);
    expect(graph.nodes[0]?.id).toBe('c1');
  });

  it('handles cycle in relationships', () => {
    const graph = buildConceptGraph(
      [
        { ...concepts[0], id: 'a', name: 'A' },
        { ...concepts[1], id: 'b', name: 'B' },
      ],
      [
        { id: 'r1', relationshipType: 'related_to', sourceConceptId: 'a', targetConceptId: 'b' },
        { id: 'r2', relationshipType: 'related_to', sourceConceptId: 'b', targetConceptId: 'a' },
      ]
    );
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(2);
  });

  it('includes relationshipType in edge data', () => {
    const graph = buildConceptGraph(concepts, relationships);
    const edge = graph.edges[0];
    expect(edge).toBeTruthy();
    expect(edge.data).toEqual({ relationshipType: 'prerequisite' });
  });
});

describe('getEvidence', () => {
  it('returns empty array for null', () => {
    expect(getEvidence(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(getEvidence(undefined)).toEqual([]);
  });

  it('filters valid evidence items', () => {
    const result = getEvidence([{ excerpt: 'test', blockId: 'b1' }, { excerpt: 'also valid' }]);
    expect(result.length).toBe(2);
    expect(result[0]?.excerpt).toBe('test');
  });

  it('filters out items without excerpt', () => {
    const result = getEvidence([
      { excerpt: 'valid' },
      { blockId: 'b1' } as unknown as { excerpt: string },
    ]);
    expect(result.length).toBe(1);
  });
});

describe('shortenBlockId', () => {
  it('returns last segment after colon', () => {
    expect(shortenBlockId('source-1:block-0001')).toBe('block-0001');
  });

  it('returns full id when no colon', () => {
    expect(shortenBlockId('simple-id')).toBe('simple-id');
  });
});
