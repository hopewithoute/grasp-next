import { MarkerType, type Edge, type Node } from '@xyflow/react';
import dagre from 'dagre';
import type { ConceptNodeData, ConceptRow, RelationshipRow, SourceEvidence } from './types';

const NODE_WIDTH = 224;
const NODE_HEIGHT = 88;

export function buildConceptGraph(
  concepts: ConceptRow[],
  relationships: RelationshipRow[]
): {
  edges: Edge[];
  nodes: Array<Node<ConceptNodeData, 'concept'>>;
} {
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const edges: Edge[] = [];
  for (const relationship of relationships) {
    if (
      !conceptIds.has(relationship.sourceConceptId) ||
      !conceptIds.has(relationship.targetConceptId)
    ) {
      continue;
    }

    edges.push({
      animated: true,
      data: { relationshipType: relationship.relationshipType },
      id: relationship.id,
      markerEnd: {
        color: 'var(--brand-accent)',
        type: MarkerType.ArrowClosed,
      },
      source: relationship.sourceConceptId,
      style: {
        stroke: 'var(--brand-accent)',
        strokeWidth: 2,
      },
      target: relationship.targetConceptId,
      type: 'step',
    });
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    align: 'UL',
    edgesep: 60,
    marginx: 40,
    marginy: 40,
    nodesep: 50,
    rankdir: 'LR',
    ranksep: 180,
  });

  for (const concept of concepts) {
    g.setNode(concept.id, { height: NODE_HEIGHT, width: NODE_WIDTH });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const nodes = concepts.map((concept) => {
    const pos = g.node(concept.id);
    return {
      data: {
        confidence: concept.confidence,
        difficulty: concept.difficulty,
        label: concept.name,
      },
      height: NODE_HEIGHT,
      id: concept.id,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      type: 'concept' as const,
      width: NODE_WIDTH,
    };
  });

  return { edges, nodes };
}

export { type SourceEvidence };

export function getEvidence(value: SourceEvidence[] | null | undefined): SourceEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is SourceEvidence => {
    return (
      typeof item === 'object' &&
      item !== null &&
      'excerpt' in item &&
      typeof item.excerpt === 'string'
    );
  });
}

export function shortenBlockId(blockId: string) {
  const parts = blockId.split(':');
  return parts.at(-1) ?? blockId;
}
