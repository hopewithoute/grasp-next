'use client';

import { memo, useCallback, type MouseEvent } from 'react';
import { Background, MiniMap, ReactFlow, type Node } from '@xyflow/react';
import { useTheme } from 'next-themes';
import { useClientHydrated } from '../hooks/use-concept-graph-state';
import { useDecoratedGraph } from '../hooks/use-decorated-graph';
import { useEvidenceLoader } from '../hooks/use-evidence-loader';
import { usePendingProposals } from '../hooks/use-pending-proposals-context';
import { type ConceptNodeData, type ConceptRow, type RelationshipRow } from '../types';
import {
  ConceptDetailStrip,
  ConceptEvidenceDialog,
  GraphCanvasSkeleton,
} from './evidence-dialog-components';
import { FlowToolbar } from './flow-toolbar';
import { GraphCanvasEmpty, GraphListFallback } from './graph-list-fallback';
import { nodeTypes } from './node-types';
import { PaneHeader } from './shared-components';

const FIT_VIEW_OPTIONS = { padding: 0.22 };
const PRO_OPTIONS = { hideAttribution: true };

export const GraphCanvasPane = memo(function GraphCanvasPane({
  projectId,
  concepts,
  conceptNameById,
  isRunning,
  onSelectConcept,
  relationships,
  selectedConcept,
  hoveredChatConceptId,
  onAcceptProposal,
  onRejectProposal,
  viewToggle,
}: {
  projectId: string;
  concepts: ConceptRow[];
  conceptNameById: Map<string, string>;
  isRunning: boolean;
  onSelectConcept: (id: string, multi?: boolean) => void;
  relationships: RelationshipRow[];
  selectedConcept: ConceptRow | null;
  hoveredChatConceptId?: string | null;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  viewToggle?: React.ReactNode;
}) {
  const { pendingProposals } = usePendingProposals();
  const proposalCount = pendingProposals.length;
  const hasGraph = concepts.length > 0 && relationships.length > 0;
  const hasConcepts = concepts.length > 0;

  const {
    conceptId: detailModalConceptId,
    evidence: evidenceData,
    isLoading: isLoadingEvidence,
    open: openEvidenceDialog,
    close: closeEvidenceDialog,
  } = useEvidenceLoader(projectId);

  const handleSelectConcept = useCallback(
    (id: string, multi?: boolean) => {
      onSelectConcept(id, multi);
    },
    [onSelectConcept]
  );

  const modalConcept = detailModalConceptId
    ? (concepts.find((c) => c.id === detailModalConceptId) ?? null)
    : null;

  return (
    <section
      aria-label="Concept graph canvas"
      className="border-border bg-background flex min-h-[520px] flex-1 flex-col border-b lg:min-h-0 lg:border-r lg:border-b-0"
    >
      <PaneHeader meta={null} actions={viewToggle} title="[ CONCEPT_GRAPH ]" />

      {isRunning || proposalCount > 0 ? (
        <div className="hairline-shimmer border-brand-accent/50 bg-brand-accent/10 mx-4 mb-3 flex items-center gap-3 rounded-none border px-3.5 py-1.5 shadow-[0_0_10px_rgba(0,255,128,0.1)]">
          <span aria-hidden className="bg-brand-accent animate-pulse-soft size-1.5" />
          <span className="text-brand-accent font-mono text-[0.62rem] tracking-[0.2em] uppercase tabular-nums">
            {isRunning ? '[ STREAMING ]' : '[ BUFFERED ]'}
          </span>
          <span className="text-muted-foreground/70 font-mono text-xs tracking-widest uppercase">
            {proposalCount === 0
              ? '[ AGENT_READING_SOURCE ]'
              : `[ ${proposalCount}_CONCEPT${proposalCount === 1 ? '' : 'S'}_PROPOSED ]`}
          </span>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {hasConcepts ? (
          hasGraph ? (
            <>
              <ConceptEvidenceDialog
                concept={modalConcept}
                relationships={relationships}
                conceptNameById={conceptNameById}
                isOpen={!!detailModalConceptId}
                onClose={closeEvidenceDialog}
                evidenceData={evidenceData}
                isLoadingEvidence={isLoadingEvidence}
                onSelectConcept={handleSelectConcept}
              />
              <GraphCanvas
                concepts={concepts}
                onSelectConcept={handleSelectConcept}
                relationships={relationships}
                selectedConceptId={selectedConcept?.id ?? null}
                onViewDetails={openEvidenceDialog}
                hoveredChatConceptId={hoveredChatConceptId}
                onAcceptProposal={onAcceptProposal}
                onRejectProposal={onRejectProposal}
              />
            </>
          ) : (
            <GraphListFallback
              concepts={concepts}
              onSelectConcept={onSelectConcept}
              selectedConceptId={selectedConcept?.id ?? null}
            />
          )
        ) : (
          <GraphCanvasEmpty />
        )}
      </div>

      <ConceptDetailStrip
        concept={selectedConcept}
        conceptNameById={conceptNameById}
        onSelectConcept={handleSelectConcept}
        relationships={relationships}
        onViewEvidence={() => {
          if (selectedConcept) openEvidenceDialog(selectedConcept.id);
        }}
      />
    </section>
  );
});

function GraphCanvas({
  concepts,
  onSelectConcept,
  relationships,
  selectedConceptId,
  onViewDetails,
  hoveredChatConceptId,
  onAcceptProposal,
  onRejectProposal,
}: {
  concepts: ConceptRow[];
  onSelectConcept: (id: string, multi?: boolean) => void;
  relationships: RelationshipRow[];
  selectedConceptId: string | null;
  onViewDetails: (id: string) => void;
  hoveredChatConceptId?: string | null;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
}) {
  const { pendingProposals } = usePendingProposals();
  const { resolvedTheme } = useTheme();
  const isClientHydrated = useClientHydrated();

  const { nodes, edges } = useDecoratedGraph({
    concepts,
    relationships,
    pendingProposals,
    selectedConceptId,
    hoveredChatConceptId,
    onViewDetails,
    onAcceptProposal,
    onRejectProposal,
  });

  const handleNodeClick = useCallback(
    (event: MouseEvent, node: Node<ConceptNodeData, 'concept'>) => {
      onSelectConcept(node.id, event.ctrlKey || event.metaKey || event.shiftKey);
    },
    [onSelectConcept]
  );

  if (!isClientHydrated) return <GraphCanvasSkeleton />;

  return (
    <ReactFlow
      colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
      edges={edges}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      maxZoom={1.4}
      minZoom={0.4}
      nodes={nodes}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      onNodeClick={handleNodeClick}
      panOnDrag
      proOptions={PRO_OPTIONS}
      zoomOnDoubleClick={false}
    >
      <Background gap={22} size={1} />
      <MiniMap
        nodeColor={resolvedTheme === 'dark' ? '#FF6A00' : '#E65C00'}
        bgColor={resolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff'}
        maskColor={resolvedTheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'}
        style={{
          borderRadius: 0,
          border: '1px solid var(--border)',
          width: 180,
          height: 120,
          backgroundColor: resolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff',
        }}
        pannable
        zoomable
      />
      <FlowToolbar />
    </ReactFlow>
  );
}
