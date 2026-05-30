'use client';

import { useCallback, memo, type MouseEvent } from 'react';
import { useTheme } from 'next-themes';
import {
  Background,
  MiniMap,
  ReactFlow,
  type Node,
} from '@xyflow/react';
import {
  type ConceptRow,
  type RelationshipRow,
  type ConceptNodeData,
} from '../types';
import { PaneHeader, DifficultyChip, ConfidencePill } from './shared-components';
import { useClientHydrated } from '../hooks/use-concept-graph-state';
import { useEvidenceLoader } from '../hooks/use-evidence-loader';
import { useDecoratedGraph } from '../hooks/use-decorated-graph';
import { nodeTypes } from './concept-node';
import { FlowToolbar } from './flow-toolbar';
import { GraphListFallback, GraphCanvasEmpty } from './graph-list-fallback';
import {
  ConceptDetailStrip,
  GraphCanvasSkeleton,
  RelationshipsStrip,
  EvidenceSkeleton,
  EvidenceStack,
} from './evidence-dialog-components';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const FIT_VIEW_OPTIONS = { padding: 0.22 };
const PRO_OPTIONS = { hideAttribution: true };

export const GraphCanvasPane = memo(function GraphCanvasPane({
  projectId,
  concepts,
  conceptNameById,
  isRunning,
  onSelectConcept,
  proposalCount,
  relationships,
  selectedConcept,
  hoveredChatConceptId,
  pendingProposals = [],
}: {
  projectId: string;
  concepts: ConceptRow[];
  conceptNameById: Map<string, string>;
  isRunning: boolean;
  onSelectConcept: (id: string, multi?: boolean) => void;
  proposalCount: number;
  relationships: RelationshipRow[];
  selectedConcept: ConceptRow | null;
  hoveredChatConceptId?: string | null;
  pendingProposals?: import('../types').ProposalPayload[];
}) {
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
      className="flex min-h-[520px] flex-col border-b border-border bg-background lg:min-h-0 lg:border-b-0 lg:border-r"
    >
      <PaneHeader eyebrow="Concept graph" meta={null} title="Interactive Canvas" />

      {isRunning || proposalCount > 0 ? (
        <div className="hairline-shimmer mx-4 mb-3 flex items-center gap-3 rounded-full border border-brand-accent-border bg-brand-accent-surface px-3.5 py-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
          <span className="font-mono text-[0.62rem] tabular-nums tracking-[0.16em] uppercase text-brand-accent-foreground">
            {isRunning ? 'Streaming' : 'Buffered'}
          </span>
          <span className="text-xs text-muted-foreground">
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
                  <DialogContent className="w-[95vw] max-w-2xl sm:max-w-4xl md:max-w-5xl lg:max-w-[1200px] max-h-[85vh] overflow-hidden !p-0 gap-0 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_40px_-15px_rgba(0,0,0,0.3)] bg-card/95 backdrop-blur-xl">
                    <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
                      {/* Left Side: Context / Asymmetric layout */}
                      <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-border/40 p-8 md:p-10 flex flex-col bg-muted/20 h-auto md:h-full md:overflow-y-auto">
                        <DialogHeader className="text-left space-y-4">
                          <div className="space-y-2">
                            <span className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground">
                              Concept Analysis
                            </span>
                            <DialogTitle className="text-2xl md:text-3xl tracking-tight leading-none text-foreground">
                              {modalConcept.name}
                            </DialogTitle>
                          </div>
                          <DialogDescription className="text-sm leading-relaxed text-foreground/60 mt-4">
                            {modalConcept.definition}
                          </DialogDescription>
                        </DialogHeader>

                        <div className="mt-8 pt-8 border-t border-border/40">
                          <span className="block mb-4 font-mono text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground">
                            Connections
                          </span>
                          <RelationshipsStrip
                            concept={modalConcept}
                            onSelectConcept={handleSelectConcept}
                            relationships={relationships}
                            conceptNameById={conceptNameById}
                          />
                        </div>

                        <div className="mt-10 flex flex-wrap gap-3 mt-auto pt-8">
                          <DifficultyChip difficulty={modalConcept.difficulty} />
                          <ConfidencePill confidence={modalConcept.confidence} />
                        </div>
                      </div>

                      {/* Right Side: Evidence List */}
                      <div className="w-full md:w-2/3 p-8 md:p-10 h-auto md:h-full md:overflow-y-auto">
                        {isLoadingEvidence ? (
                          <EvidenceSkeleton />
                        ) : evidenceData.length > 0 ? (
                          <EvidenceStack
                            evidence={evidenceData}
                            totalCount={evidenceData.length}
                          />
                        ) : (
                          <div className="py-8 text-sm leading-relaxed text-muted-foreground/60 border-t border-border/50">
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
                pendingProposals={pendingProposals}
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
  pendingProposals = [],
}: {
  concepts: ConceptRow[];
  onSelectConcept: (id: string, multi?: boolean) => void;
  relationships: RelationshipRow[];
  selectedConceptId: string | null;
  onViewDetails: (id: string) => void;
  hoveredChatConceptId?: string | null;
  pendingProposals?: import('../types').ProposalPayload[];
}) {
  const { resolvedTheme } = useTheme();
  const isClientHydrated = useClientHydrated();

  const { nodes, edges } = useDecoratedGraph({
    concepts,
    relationships,
    pendingProposals,
    selectedConceptId,
    hoveredChatConceptId,
    onViewDetails,
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
