import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ConceptDetailPanel,
  ConceptList,
  
  type ConceptRow,
  type RelationshipRow,
} from './concept-graph-view';
import { buildConceptGraph } from './concept-graph-utils';

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

describe('concept graph review', () => {
  it('builds a graph layout that preserves prerequisite order', () => {
    const graph = buildConceptGraph(concepts, relationships);

    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.nodes[0]?.id, 'c1');
    assert.equal(graph.nodes[1]?.id, 'c2');
    assert.equal(graph.nodes[0]?.position.x, 0);
    assert.equal(graph.nodes[1]?.position.x, 280);
    assert.equal(graph.edges[0]?.source, 'c1');
    assert.equal(graph.edges[0]?.target, 'c2');
  });

  it('renders the list fallback with evidence when no relationships exist', () => {
    const markup = renderToStaticMarkup(<ConceptList concepts={concepts.slice(0, 1)} />);

    assert.match(markup, /Force/);
    assert.match(markup, /Force changes motion\./);
    assert.match(markup, /beginner/);
  });

  it('renders the selected concept detail panel with relationship links', () => {
    const conceptNameById = new Map(concepts.map((concept) => [concept.id, concept.name]));
    const markup = renderToStaticMarkup(
      <ConceptDetailPanel
        concept={concepts[1] ?? null}
        conceptNameById={conceptNameById}
        relationships={relationships}
      />
    );

    assert.match(markup, /Acceleration/);
    assert.match(markup, /rate of change of velocity/);
    assert.match(markup, /block-0002/);
    assert.match(markup, /Force/);
    assert.match(markup, /prerequisite/);
  });
});
