import { Edge, Node, MarkerType } from '@xyflow/react';
import type { ConceptRow, RelationshipRow, ConceptNodeData } from './concept-graph-view';

export function buildConceptGraph(
  concepts: ConceptRow[],
  relationships: RelationshipRow[]
): {
  edges: Edge[];
  nodes: Array<Node<ConceptNodeData, 'concept'>>;
} {
  const depthByConceptId = getDepthByConceptId(concepts, relationships);
  const rowByDepth = new Map<number, number>();

  const nodes = concepts.map((concept) => {
    const depth = depthByConceptId.get(concept.id) ?? 0;
    const row = rowByDepth.get(depth) ?? 0;
    rowByDepth.set(depth, row + 1);

    return {
      data: {
        confidence: concept.confidence,
        difficulty: concept.difficulty,
        label: concept.name,
      },
      id: concept.id,
      position: {
        x: depth * 280,
        y: row * 132 + (depth % 2) * 36,
      },
      type: 'concept' as const,
    };
  });

  const edges = relationships.map((relationship) => ({
    animated: false,
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
  }));

  return {
    edges,
    nodes,
  };
}

function getDepthByConceptId(concepts: ConceptRow[], relationships: RelationshipRow[]) {
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const incomingCount = new Map(concepts.map((concept) => [concept.id, 0]));
  const outgoing = new Map<string, string[]>();

  for (const relationship of relationships) {
    if (
      !conceptIds.has(relationship.sourceConceptId) ||
      !conceptIds.has(relationship.targetConceptId)
    ) {
      continue;
    }

    incomingCount.set(
      relationship.targetConceptId,
      (incomingCount.get(relationship.targetConceptId) ?? 0) + 1
    );
    outgoing.set(relationship.sourceConceptId, [
      ...(outgoing.get(relationship.sourceConceptId) ?? []),
      relationship.targetConceptId,
    ]);
  }

  const depthByConceptId = new Map<string, number>();
  const queue = concepts.reduce<string[]>((acc, concept) => {
    if ((incomingCount.get(concept.id) ?? 0) === 0) {
      acc.push(concept.id);
    }
    return acc;
  }, []);

  for (const conceptId of queue) {
    depthByConceptId.set(conceptId, 0);
  }

  while (queue.length) {
    const conceptId = queue.shift();

    if (!conceptId) {
      break;
    }

    const nextDepth = (depthByConceptId.get(conceptId) ?? 0) + 1;

    for (const targetId of outgoing.get(conceptId) ?? []) {
      if ((depthByConceptId.get(targetId) ?? -1) < nextDepth) {
        depthByConceptId.set(targetId, nextDepth);
        queue.push(targetId);
      }
    }
  }

  for (const concept of concepts) {
    if (!depthByConceptId.has(concept.id)) {
      depthByConceptId.set(concept.id, 0);
    }
  }

  return depthByConceptId;
}

export type SourceEvidence = {
  blockId?: string;
  excerpt: string;
  location?: string;
  sourceId?: string;
};

export function getEvidence(value: unknown): SourceEvidence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is SourceEvidence => {
    return (
      typeof item === 'object' &&
      item !== null &&
      'excerpt' in item &&
      typeof item.excerpt === 'string' &&
      item.excerpt.trim().length > 0
    );
  });
}

export function shortenBlockId(blockId: string) {
  const parts = blockId.split(':');
  return parts.at(-1) ?? blockId;
}

export function formatConfidence(value: string) {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    return 'confidence n/a';
  }

  return `${Math.round(confidence * 100)}%`;
}

export function formatRelationshipType(value: string) {
  return value.replaceAll('_', ' ');
}
