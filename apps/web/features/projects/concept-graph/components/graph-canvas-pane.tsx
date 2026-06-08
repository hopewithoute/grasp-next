'use client';

import { memo, useCallback, type MouseEvent } from 'react';
import { Background, MiniMap, ReactFlow, type Node } from '@xyflow/react';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useClientHydrated } from '../hooks/use-concept-graph-state';
import { useDecoratedGraph } from '../hooks/use-decorated-graph';
import { useEvidenceLoader } from '../hooks/use-evidence-loader';
import { usePendingProposals } from '../hooks/use-pending-proposals-context';
import { type ConceptNodeData, type ConceptRow, type RelationshipRow } from '../types';
import {
  ConceptDetailStrip,
  EvidenceSkeleton,
  EvidenceStack,
  GraphCanvasSkeleton,
  RelationshipsStrip,
} from './evidence-dialog-components';
import { FlowToolbar } from './flow-toolbar';
import { GraphCanvasEmpty, GraphListFallback } from './graph-list-fallback';
import { nodeTypes } from './node-types';
import { ConfidencePill, DifficultyChip, PaneHeader } from './shared-components';

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
      <PaneHeader eyebrow="Concept graph" meta={null} title="Interactive Canvas" />

      {isRunning || proposalCount > 0 ? (
        <div className="hairline-shimmer border-brand-accent-border bg-brand-accent-surface mx-4 mb-3 flex items-center gap-3 rounded-full border px-3.5 py-1.5">
          <span aria-hidden className="bg-brand-accent pulse-soft size-1.5 rounded-full" />
          <span className="text-brand-accent-foreground font-mono text-[0.62rem] tracking-[0.16em] uppercase tabular-nums">
            {isRunning ? 'Streaming' : 'Buffered'}
          </span>
          <span className="text-muted-foreground text-xs">
            {proposalCount === 0
              ? 'agent is reading source'
              : `${proposalCount} concept${proposalCount === 1 ? '' : 's'} proposed`}
          </span>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {hasConcepts ? (
          hasGraph ? (
            <>
              {modalConcept ? (
                <Dialog
                  open={!!detailModalConceptId}
                  onOpenChange={(open) => {
                    if (!open) closeEvidenceDialog();
                  }}
                >
                  <DialogContent className="bg-card/95 max-h-[85vh] w-[95vw] max-w-2xl gap-0 overflow-hidden border-white/10 !p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_40px_-15px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:max-w-4xl md:max-w-5xl lg:max-w-[1200px]">
                    <div className="flex h-full max-h-[85vh] flex-col md:flex-row">
                      {/* Left Side: Context / Asymmetric layout */}
                      <div className="border-border/40 bg-muted/20 flex h-auto w-full flex-col border-b p-8 md:h-full md:w-1/3 md:overflow-y-auto md:border-r md:border-b-0 md:p-10">
                        <DialogHeader className="space-y-4 text-left">
                          <div className="space-y-2">
                            <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                              Concept Analysis
                            </span>
                            <DialogTitle className="text-foreground text-2xl leading-none tracking-tight md:text-3xl">
                              {modalConcept.name}
                            </DialogTitle>
                          </div>
                          <DialogDescription className="text-foreground/60 mt-4 text-sm leading-relaxed">
                            {modalConcept.definition}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="border-border/40 mt-8 border-t pt-8">
                          <span className="text-muted-foreground mb-4 block font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                            Connections
                          </span>
                          <RelationshipsStrip
                            concept={modalConcept}
                            onSelectConcept={handleSelectConcept}
                            relationships={relationships}
                            conceptNameById={conceptNameById}
                          />
                        </div>

                        <div className="mt-10 mt-auto flex flex-wrap gap-3 pt-8">
                          <DifficultyChip difficulty={modalConcept.difficulty} />
                          <ConfidencePill confidence={modalConcept.confidence} />
                        </div>
                      </div>

                      {/* Right Side: Evidence List */}
                      <div className="h-auto w-full p-8 md:h-full md:w-2/3 md:overflow-y-auto md:p-10">
                        {isLoadingEvidence ? (
                          <EvidenceSkeleton />
                        ) : evidenceData.length > 0 ? (
                          <EvidenceStack evidence={evidenceData} totalCount={evidenceData.length} />
                        ) : (
                          <div className="text-muted-foreground/60 border-border/50 border-t py-8 text-sm leading-relaxed">
                            No source evidence attached.
                          </div>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : null}
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
        nodeColor={resolvedTheme === 'dark' ? '#53d1cb' : '#0d9488'}
        bgColor={resolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff'}
        maskColor={resolvedTheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'}
        style={{
          borderRadius: 12,
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
