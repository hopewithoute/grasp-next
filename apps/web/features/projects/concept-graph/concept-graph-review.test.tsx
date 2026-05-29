import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type ConceptRow, type RelationshipRow } from './types';
import { buildConceptGraph, getEvidence, shortenBlockId } from './concept-graph-utils';

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

    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.edges[0]?.source, 'c1');
    assert.equal(graph.edges[0]?.target, 'c2');
    assert.equal(graph.edges[0]?.type, 'step');
  });

  it('omits edges whose endpoint concepts are outside the rendered graph window', () => {
    const graph = buildConceptGraph([concepts[0]!], relationships);

    assert.equal(graph.nodes.length, 1);
    assert.equal(graph.edges.length, 0);
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

    assert.equal(graph.nodes.length, 4);
    assert.equal(graph.edges.length, 4);

    const xByNodeId = new Map(graph.nodes.map((node) => [node.id, node.position.x]));
    assert.ok((xByNodeId.get('c4') ?? 0) > (xByNodeId.get('c1') ?? 0));
  });

  it('returns empty graph for no concepts', () => {
    const graph = buildConceptGraph([], []);
    assert.equal(graph.nodes.length, 0);
    assert.equal(graph.edges.length, 0);
  });

  it('handles single node with no edges', () => {
    const graph = buildConceptGraph([concepts[0]!], []);
    assert.equal(graph.nodes.length, 1);
    assert.equal(graph.edges.length, 0);
    assert.equal(graph.nodes[0]?.id, 'c1');
  });

  it('handles cycle in relationships', () => {
    const graph = buildConceptGraph(
      [
        { ...concepts[0]!, id: 'a', name: 'A' },
        { ...concepts[1]!, id: 'b', name: 'B' },
      ],
      [
        { id: 'r1', relationshipType: 'related_to', sourceConceptId: 'a', targetConceptId: 'b' },
        { id: 'r2', relationshipType: 'related_to', sourceConceptId: 'b', targetConceptId: 'a' },
      ]
    );
    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 2);
  });

  it('includes relationshipType in edge data', () => {
    const graph = buildConceptGraph(concepts, relationships);
    const edge = graph.edges[0];
    assert.ok(edge);
    assert.deepEqual(edge.data, { relationshipType: 'prerequisite' });
  });
});

describe('getEvidence', () => {
  it('returns empty array for null', () => {
    assert.deepEqual(getEvidence(null), []);
  });

  it('returns empty array for undefined', () => {
    assert.deepEqual(getEvidence(undefined), []);
  });

  it('filters valid evidence items', () => {
    const result = getEvidence([{ excerpt: 'test', blockId: 'b1' }, { excerpt: 'also valid' }]);
    assert.equal(result.length, 2);
    assert.equal(result[0]?.excerpt, 'test');
  });

  it('filters out items without excerpt', () => {
    const result = getEvidence([
      { excerpt: 'valid' },
      { blockId: 'b1' } as unknown as { excerpt: string },
    ]);
    assert.equal(result.length, 1);
  });
});

describe('shortenBlockId', () => {
  it('returns last segment after colon', () => {
    assert.equal(shortenBlockId('source-1:block-0001'), 'block-0001');
  });

  it('returns full id when no colon', () => {
    assert.equal(shortenBlockId('simple-id'), 'simple-id');
  });
});
