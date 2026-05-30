import { describe, expect, it } from 'vitest';
import {
  buildKnowledgebaseArtifactContent,
  projectKnowledgebaseGraph,
} from './build-knowledgebase-artifact';

describe('buildKnowledgebaseArtifactContent', () => {
  it('stores native knowledgebase content with a deterministic graph projection', () => {
    const knowledgebase = knowledgebaseFixture();
    const content = buildKnowledgebaseArtifactContent({
      knowledgebase,
      normalizedSource: normalizedSource(),
    });

    expect('conceptGraph' in content).toBe(false);
    expect('learningWiki' in content).toBe(false);
    expect(content.knowledgebase.concepts[0]?.id).toBeTruthy();
    expect(content.graphProjection.nodes.map((node) => node.conceptId)).toEqual(['market', 'demand']);
    expect(content.graphProjection.edges.map((edge) => edge.relationshipId)).toEqual(['relationship-0001']);
  });
});

describe('projectKnowledgebaseGraph', () => {
  it('projects graph nodes and edges from knowledgebase ids', () => {
    const projection = projectKnowledgebaseGraph(knowledgebaseFixture());

    expect(projection.nodes[0]?.id).toBe('node:market');
    expect(projection.edges[0]?.sourceNodeId).toBe('node:market');
    expect(projection.edges[0]?.targetNodeId).toBe('node:demand');
  });
});

function knowledgebaseFixture() {
  return {
    concepts: [
      {
        confidence: 0.9,
        definition: 'A place where buyers and sellers coordinate exchange.',
        difficulty: 'beginner' as const,
        id: 'market',
        name: 'Market',
        sourceRefs: [sourceRef()],
      },
      {
        confidence: 0.8,
        definition: 'The amount of a good that buyers want.',
        difficulty: 'beginner' as const,
        id: 'demand',
        name: 'Demand',
        sourceRefs: [sourceRef()],
      },
    ],
    overview: 'Markets coordinate supply and demand.',
    relationships: [
      {
        id: 'relationship-0001',
        relationshipType: 'prerequisite' as const,
        sourceConceptId: 'market',
        sourceRefs: [sourceRef()],
        targetConceptId: 'demand',
      },
    ],
  };
}

function normalizedSource() {
  return {
    blocks: [
      {
        id: 'source-1:block-0001',
        kind: 'paragraph' as const,
        location: { label: 'Market source / Block 1' },
        order: 0,
        sourceId: 'source-1',
        text: 'Markets coordinate supply and demand.',
      },
    ],
    id: 'project-1:source-set:current',
    sourceType: 'text' as const,
    title: 'Project sources',
  };
}

function sourceRef() {
  return {
    blockId: 'source-1:block-0001',
    locationLabel: 'Market source / Block 1',
    quote: 'Markets coordinate supply and demand.',
    sourceId: 'source-1',
  };
}
