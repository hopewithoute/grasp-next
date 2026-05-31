import { useMemo } from 'react';
import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { type ConceptRow, type RelationshipRow, type ConceptNodeData } from '../types';
import { buildConceptGraph } from '../concept-graph-utils';
import { type PendingProposal } from './use-concept-graph-state';

// --- Types ---

export type DecoratedGraphInput = {
  concepts: ConceptRow[];
  relationships: RelationshipRow[];
  pendingProposals: PendingProposal[];
  selectedConceptId: string | null;
  hoveredChatConceptId?: string | null;
  onViewDetails: (id: string) => void;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
};

export type DecoratedGraphResult = {
  nodes: Array<Node<ConceptNodeData, 'concept'>>;
  edges: Edge[];
  ghostAddIds: Set<string>;
  ghostUpdateIds: Set<string>;
  ghostDeleteIds: Set<string>;
  ghostRelAddIds: Set<string>;
  ghostRelDeleteIds: Set<string>;
};

export type MergedProposalResult = {
  mergedConcepts: ConceptRow[];
  mergedRelationships: RelationshipRow[];
  ghostAddIds: Set<string>;
  ghostUpdateIds: Set<string>;
  ghostDeleteIds: Set<string>;
  ghostRelAddIds: Set<string>;
  ghostRelDeleteIds: Set<string>;
  nodeProposalMap: Map<string, string>;
};

// --- Pure helper ---

function payloadString(value: boolean | number | string | null | undefined): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

/**
 * Pure function: merges pending proposals into the concept/relationship lists,
 * returning ghost-tracking sets for visual decoration.
 */
export function mergeProposals(
  concepts: ConceptRow[],
  relationships: RelationshipRow[],
  pendingProposals: PendingProposal[]
): MergedProposalResult {
  let newConcepts = [...concepts];
  const newRelationships = [...relationships];
  const conceptById = new Map(concepts.map((c) => [c.id, c]));
  const conceptByName = new Map(concepts.map((c) => [c.name.toLowerCase(), c]));
  const relationshipByEndpoints = new Map(
    relationships.map((r) => [`${r.sourceConceptId}:${r.targetConceptId}`, r])
  );

  const ghostAddIds = new Set<string>();
  const ghostUpdateIds = new Set<string>();
  const ghostDeleteIds = new Set<string>();
  const ghostRelAddIds = new Set<string>();
  const ghostRelDeleteIds = new Set<string>();
  const nodeProposalMap = new Map<string, string>();

  const findConcept = (key: string | undefined) => {
    if (!key) return undefined;
    return conceptById.get(key) ?? conceptByName.get(key.toLowerCase());
  };

  const indexConcept = (concept: ConceptRow) => {
    conceptById.set(concept.id, concept);
    conceptByName.set(concept.name.toLowerCase(), concept);
  };

  for (const [proposalIndex, proposal] of pendingProposals.entries()) {
    for (const action of proposal.actions) {
      const { conceptKey, name: payloadName, id: payloadId, definition, confidence, difficulty } = action.payload as Record<string, string | undefined>;
      const actionType = action.type.replace('-', '_');

      if (actionType === 'add_concept') {
        const ghostId =
          payloadString(conceptKey) ??
          payloadString(payloadName) ??
          `ghost-${proposalIndex}-${ghostAddIds.size}`;
        const ghostConcept = {
          id: ghostId,
          name: payloadString(payloadName) ?? 'New Concept',
          definition: payloadString(definition) ?? '',
          confidence: payloadString(confidence) ?? 'LOW',
          difficulty: payloadString(difficulty) ?? 'BEGINNER',
        } as ConceptRow;
        newConcepts.push(ghostConcept);
        indexConcept(ghostConcept);
        ghostAddIds.add(ghostId);
        nodeProposalMap.set(ghostId, proposal.id);
      } else if (actionType === 'update_concept') {
        const key =
          payloadString(conceptKey) ??
          payloadString(payloadName) ??
          payloadString(payloadId);
        const target = findConcept(key);
        if (target) {
          ghostUpdateIds.add(target.id);
          nodeProposalMap.set(target.id, proposal.id);
          const updatedConcept = { ...target, ...action.payload };
          newConcepts = newConcepts.map((c) => (c.id === target.id ? updatedConcept : c));
          indexConcept(updatedConcept);
        }
      } else if (actionType === 'delete_concept') {
        const key =
          payloadString(conceptKey) ??
          payloadString(payloadName) ??
          payloadString(payloadId);
        const target = findConcept(key);
        if (target) {
          ghostDeleteIds.add(target.id);
          nodeProposalMap.set(target.id, proposal.id);
        }
      } else if (actionType === 'add_relationship') {
        const srcKey =
          payloadString(action.payload.sourceConceptKey) ??
          payloadString(action.payload.sourceName);
        const tgtKey =
          payloadString(action.payload.targetConceptKey) ??
          payloadString(action.payload.targetName);
        const src = findConcept(srcKey);
        const tgt = findConcept(tgtKey);
        if (src && tgt) {
          const relId = `ghost-rel-${src.id}-${tgt.id}`;
          const relationship = {
            id: relId,
            sourceConceptId: src.id,
            targetConceptId: tgt.id,
            relationshipType: payloadString(action.payload.relationshipType) ?? 'related_to',
          } as RelationshipRow;
          newRelationships.push(relationship);
          relationshipByEndpoints.set(`${src.id}:${tgt.id}`, relationship);
          ghostRelAddIds.add(relId);
        }
      } else if (actionType === 'delete_relationship') {
        const srcKey =
          payloadString(action.payload.sourceConceptKey) ??
          payloadString(action.payload.sourceName);
        const tgtKey =
          payloadString(action.payload.targetConceptKey) ??
          payloadString(action.payload.targetName);
        const src = findConcept(srcKey);
        const tgt = findConcept(tgtKey);
        if (src && tgt) {
          const existingRel = relationshipByEndpoints.get(`${src.id}:${tgt.id}`);
          if (existingRel) ghostRelDeleteIds.add(existingRel.id);
        }
      }
    }
  }

  return {
    mergedConcepts: newConcepts,
    mergedRelationships: newRelationships,
    ghostAddIds,
    ghostUpdateIds,
    ghostDeleteIds,
    ghostRelAddIds,
    ghostRelDeleteIds,
    nodeProposalMap,
  };
}

// --- Hook ---

export function useDecoratedGraph({
  concepts,
  relationships,
  pendingProposals,
  selectedConceptId,
  hoveredChatConceptId,
  onViewDetails,
  onAcceptProposal,
  onRejectProposal,
}: DecoratedGraphInput): DecoratedGraphResult {
  const {
    mergedConcepts,
    mergedRelationships,
    ghostAddIds,
    ghostUpdateIds,
    ghostDeleteIds,
    ghostRelAddIds,
    ghostRelDeleteIds,
    nodeProposalMap,
  } = useMemo(
    () => mergeProposals(concepts, relationships, pendingProposals),
    [concepts, relationships, pendingProposals]
  );

  const baseGraph = useMemo(
    () => buildConceptGraph(mergedConcepts, mergedRelationships),
    [mergedConcepts, mergedRelationships]
  );

  const decorated = useMemo(() => {
    // 1-degree neighbor calculation for Progressive Disclosure
    const neighbors = new Set<string>();
    if (selectedConceptId) {
      neighbors.add(selectedConceptId);
      for (const edge of baseGraph.edges) {
        if (edge.source === selectedConceptId) neighbors.add(edge.target);
        if (edge.target === selectedConceptId) neighbors.add(edge.source);
      }
    }

    const nodes = baseGraph.nodes.map((node) => {
      const isSelected = node.id === selectedConceptId;
      const isHoveredChat = node.id === hoveredChatConceptId;
      const isGhostAdd = ghostAddIds.has(node.id);
      const isGhostUpdate = ghostUpdateIds.has(node.id);
      const isGhostDelete = ghostDeleteIds.has(node.id);
      const proposalId = nodeProposalMap.get(node.id);
      
      const isDimmed = selectedConceptId ? !neighbors.has(node.id) : false;

      return {
        ...node,
        data: {
          ...node.data,
          selected: isSelected,
          isHoveredChat,
          isGhostAdd,
          isGhostUpdate,
          isGhostDelete,
          dimmed: isDimmed,
          proposalId,
          onViewDetails: () => onViewDetails(node.id),
          onAcceptProposal: proposalId ? () => onAcceptProposal(proposalId) : undefined,
          onRejectProposal: proposalId ? () => onRejectProposal(proposalId) : undefined,
        },
      };
    });

    const edges = baseGraph.edges.map((edge) => {
      const isLinked = edge.source === selectedConceptId || edge.target === selectedConceptId;
      const isGhostAdd = ghostRelAddIds.has(edge.id);
      const isGhostDelete = ghostRelDeleteIds.has(edge.id);

      const isSourceNeighbor = selectedConceptId ? neighbors.has(edge.source) : true;
      const isTargetNeighbor = selectedConceptId ? neighbors.has(edge.target) : true;
      const isDimmed = selectedConceptId ? !(isSourceNeighbor && isTargetNeighbor) : false;

      let strokeColor = isLinked ? 'var(--brand-accent)' : 'rgba(83, 209, 203, 0.55)';
      let strokeDasharray: string | undefined;

      if (isGhostAdd) {
        strokeColor = '#10b981';
        strokeDasharray = '5,5';
      } else if (isGhostDelete) {
        strokeColor = '#ef4444';
        strokeDasharray = '5,5';
      }

      const isAnimated = isLinked || isGhostAdd;
      const strokeWidth = isLinked || isGhostAdd ? 2 : 1.4;
      
      let opacity = 1;
      if (isGhostDelete) opacity = 0.3;
      if (isDimmed) opacity = 0.15;

      const relType = (edge.data as { relationshipType?: string } | undefined)?.relationshipType;

      return {
        ...edge,
        animated: isAnimated,
        label: isLinked && relType ? relType.replaceAll('_', ' ') : undefined,
        markerEnd: {
          color: strokeColor,
          type: MarkerType.ArrowClosed,
        },
        style: {
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          opacity,
        },
      };
    });

    return { edges, nodes };
  }, [
    baseGraph,
    selectedConceptId,
    onViewDetails,
    hoveredChatConceptId,
    ghostAddIds,
    ghostUpdateIds,
    ghostDeleteIds,
    ghostRelAddIds,
    ghostRelDeleteIds,
  ]);

  return {
    nodes: decorated.nodes,
    edges: decorated.edges,
    ghostAddIds,
    ghostUpdateIds,
    ghostDeleteIds,
    ghostRelAddIds,
    ghostRelDeleteIds,
  };
}
