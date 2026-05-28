import { useState, useRef, useMemo, useCallback, memo, type MouseEvent, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Background,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Expand, FileText, Info, Minus, Network, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getConceptEvidence } from '../actions';
import { type ConceptRow, type RelationshipRow, type ConceptNodeData } from './types';
import { buildConceptGraph, getEvidence, shortenBlockId, type SourceEvidence } from './concept-graph-utils';
import { PaneHeader, DifficultyChip, ConfidencePill } from './shared-components';
import { useClientHydrated } from './use-concept-graph-state';

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
  pendingProposals?: import('./proposal-card').ProposalPayload[];
}) {
  const hasGraph = concepts.length > 0 && relationships.length > 0;
  const hasConcepts = concepts.length > 0;
  const [detailModalConceptId, setDetailModalConceptId] = useState<string | null>(null);
  const [evidenceData, setEvidenceData] = useState<SourceEvidence[]>([]);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
  const evidenceRequestIdRef = useRef(0);

  const openEvidenceDialog = useCallback((conceptId: string) => {
    const requestId = evidenceRequestIdRef.current + 1;
    evidenceRequestIdRef.current = requestId;
    setDetailModalConceptId(conceptId);
    setEvidenceData([]);
    setIsLoadingEvidence(true);

    getConceptEvidence(projectId, conceptId)
      .then(data => {
        if (evidenceRequestIdRef.current !== requestId) return;
        setEvidenceData(getEvidence(data as Parameters<typeof getEvidence>[0]));
      })
      .finally(() => {
        if (evidenceRequestIdRef.current === requestId) {
          setIsLoadingEvidence(false);
        }
      });
  }, [projectId]);

  const handleSelectConcept = useCallback((id: string, multi?: boolean) => {
    onSelectConcept(id, multi);
  }, [onSelectConcept]);

  return (
    <section
      aria-label="Concept graph canvas"
      className="flex min-h-[520px] flex-col border-b border-border bg-background lg:min-h-0 lg:border-b-0 lg:border-r"
    >
      <PaneHeader
        eyebrow="Concept graph"
        meta={null}
        title="Interactive Canvas"
      />

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
              {detailModalConceptId ? (() => {
                const modalConcept = concepts.find(c => c.id === detailModalConceptId);
                if (!modalConcept) return null;

                return (
                  <Dialog
                    open={!!detailModalConceptId}
                    onOpenChange={(open) => {
                      if (!open) {
                        evidenceRequestIdRef.current += 1;
                        setDetailModalConceptId(null);
                        setEvidenceData([]);
                        setIsLoadingEvidence(false);
                      }
                    }}
                  >
                    <DialogContent className="w-[95vw] max-w-2xl sm:max-w-4xl md:max-w-5xl lg:max-w-[1200px] max-h-[85vh] overflow-hidden !p-0 gap-0 border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_20px_40px_-15px_rgba(0,0,0,0.3)] bg-card/95 backdrop-blur-xl">
                      <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
                        {/* Left Side: Context / Asymmetric layout */}
                        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-border/40 p-8 md:p-10 flex flex-col bg-muted/20 h-auto md:h-full md:overflow-y-auto">
                          <DialogHeader className="text-left space-y-4">
                            <div className="space-y-2">
                              <span className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground">Concept Analysis</span>
                              <DialogTitle className="text-2xl md:text-3xl tracking-tight leading-none text-foreground">{modalConcept.name}</DialogTitle>
                            </div>
                            <DialogDescription className="text-sm leading-relaxed text-foreground/60 mt-4">
                              {modalConcept.definition}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="mt-8 pt-8 border-t border-border/40">
                            <span className="block mb-4 font-mono text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground">Connections</span>
                            <RelationshipsStrip concept={modalConcept} onSelectConcept={handleSelectConcept} relationships={relationships} conceptNameById={conceptNameById} />
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
                            <EvidenceStack evidence={evidenceData} totalCount={evidenceData.length} />
                          ) : (
                            <div className="py-8 text-sm leading-relaxed text-muted-foreground/60 border-t border-border/50">
                              No source evidence attached.
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                );
              })() : null}
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
  pendingProposals?: import('./proposal-card').ProposalPayload[];
}) {
  const { resolvedTheme } = useTheme();
  const isClientHydrated = useClientHydrated();

  const { mergedConcepts, mergedRelationships, ghostAddIds, ghostUpdateIds, ghostDeleteIds, ghostRelAddIds, ghostRelDeleteIds } = useMemo(() => {
    let newConcepts = [...concepts];
    const newRelationships = [...relationships];
    const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
    const conceptByName = new Map(concepts.map((concept) => [concept.name.toLowerCase(), concept]));
    const relationshipByEndpoints = new Map(
      relationships.map((relationship) => [
        `${relationship.sourceConceptId}:${relationship.targetConceptId}`,
        relationship,
      ]),
    );
    const ghostAddIds = new Set<string>();
    const ghostUpdateIds = new Set<string>();
    const ghostDeleteIds = new Set<string>();
    const ghostRelAddIds = new Set<string>();
    const ghostRelDeleteIds = new Set<string>();

    const findConcept = (key: string | undefined) => {
      if (!key) return undefined;
      return conceptById.get(key) ?? conceptByName.get(key.toLowerCase());
    };

    const addConceptIndex = (concept: ConceptRow) => {
      conceptById.set(concept.id, concept);
      conceptByName.set(concept.name.toLowerCase(), concept);
    };
    const payloadString = (value: boolean | number | string | null | undefined) =>
      typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;

    for (const [proposalIndex, proposal] of pendingProposals.entries()) {
      for (const action of proposal.actions) {
        const actionType = action.type.replace('-', '_');
        if (actionType === 'add_concept') {
          const ghostId =
            payloadString(action.payload.conceptKey) ??
            payloadString(action.payload.name) ??
            `ghost-${proposalIndex}-${ghostAddIds.size}`;
          const ghostConcept = {
            id: ghostId,
            name: payloadString(action.payload.name) ?? 'New Concept',
            definition: payloadString(action.payload.definition) ?? '',
            confidence: payloadString(action.payload.confidence) ?? 'LOW',
            difficulty: payloadString(action.payload.difficulty) ?? 'BEGINNER'
          } as ConceptRow;
          newConcepts.push(ghostConcept);
          addConceptIndex(ghostConcept);
          ghostAddIds.add(ghostId);
        } else if (actionType === 'update_concept') {
          const key =
            payloadString(action.payload.conceptKey) ??
            payloadString(action.payload.name) ??
            payloadString(action.payload.id);
          const target = findConcept(key);
          if (target) {
            ghostUpdateIds.add(target.id);
            const updatedConcept = { ...target, ...action.payload };
            newConcepts = newConcepts.map(c => c.id === target.id ? updatedConcept : c);
            addConceptIndex(updatedConcept);
          }
        } else if (actionType === 'delete_concept') {
          const key =
            payloadString(action.payload.conceptKey) ??
            payloadString(action.payload.name) ??
            payloadString(action.payload.id);
          const target = findConcept(key);
          if (target) {
            ghostDeleteIds.add(target.id);
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
              relationshipType: payloadString(action.payload.relationshipType) ?? 'related_to'
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
    return { mergedConcepts: newConcepts, mergedRelationships: newRelationships, ghostAddIds, ghostUpdateIds, ghostDeleteIds, ghostRelAddIds, ghostRelDeleteIds };
  }, [concepts, relationships, pendingProposals]);

  const baseGraph = useMemo(
    () => buildConceptGraph(mergedConcepts, mergedRelationships),
    [mergedConcepts, mergedRelationships],
  );

  const decorated = useMemo(() => {
    const nodes = baseGraph.nodes.map((node) => {
      const isSelected = node.id === selectedConceptId;
      const isHoveredChat = node.id === hoveredChatConceptId;
      const isGhostAdd = ghostAddIds.has(node.id);
      const isGhostUpdate = ghostUpdateIds.has(node.id);
      const isGhostDelete = ghostDeleteIds.has(node.id);

      return {
        ...node,
        data: { 
          ...node.data, 
          selected: isSelected,
          isHoveredChat,
          isGhostAdd,
          isGhostUpdate,
          isGhostDelete,
          onViewDetails: () => onViewDetails(node.id),
        },
      };
    });

    const edges = baseGraph.edges.map((edge) => {
      const isLinked = edge.source === selectedConceptId || edge.target === selectedConceptId;
      const isGhostAdd = ghostRelAddIds.has(edge.id);
      const isGhostDelete = ghostRelDeleteIds.has(edge.id);
      
      let strokeColor = isLinked ? 'var(--brand-accent)' : 'rgba(83, 209, 203, 0.55)';
      let strokeDasharray = undefined;
      
      if (isGhostAdd) {
        strokeColor = '#10b981'; // emerald-500
        strokeDasharray = '5,5';
      } else if (isGhostDelete) {
        strokeColor = '#ef4444'; // red-500
        strokeDasharray = '5,5';
      }

      const isAnimated = isLinked || isGhostAdd;
      const strokeWidth = isLinked || isGhostAdd ? 2 : 1.4;
      const opacity = isGhostDelete ? 0.3 : 1;

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
  }, [baseGraph, selectedConceptId, onViewDetails, hoveredChatConceptId, ghostAddIds, ghostUpdateIds, ghostDeleteIds, ghostRelAddIds, ghostRelDeleteIds]);

  const handleNodeClick = useCallback(
    (event: MouseEvent, node: Node<ConceptNodeData, 'concept'>) => {
      onSelectConcept(node.id, event.ctrlKey || event.metaKey || event.shiftKey);
    },
    [onSelectConcept],
  );

  if (!isClientHydrated) return <GraphCanvasSkeleton />;

  return (
    <ReactFlow
      colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
      edges={decorated.edges}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      maxZoom={1.4}
      minZoom={0.4}
      nodes={decorated.nodes}
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
        style={{ borderRadius: 12, border: '1px solid var(--border)', width: 180, height: 120, backgroundColor: resolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff' }}
        pannable
        zoomable
      />
      <FlowToolbar />
    </ReactFlow>
  );
}

const ConceptNode = memo(function ConceptNode({ data }: NodeProps<Node<ConceptNodeData, 'concept'>>) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            'w-56 rounded-2xl border bg-card px-4 py-3 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
            data.selected
              ? 'border-brand-accent ring-1 ring-brand-accent/50 shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)] scale-[1.02] animate-[pulse_4s_ease-in-out_infinite]'
              : data.isHoveredChat
              ? 'border-[#53d1cb] ring-2 ring-[#53d1cb]/60 shadow-[0_0_25px_-5px_rgba(83,209,203,0.6)] scale-[1.05] animate-[pulse_1.5s_ease-in-out_infinite] z-50 relative'
              : data.isGhostAdd
              ? 'border-emerald-500/50 border-dashed bg-emerald-500/5 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)] opacity-90'
              : data.isGhostDelete
              ? 'border-destructive/50 border-dashed bg-destructive/5 opacity-50 grayscale'
              : data.isGhostUpdate
              ? 'border-blue-500/50 border-dashed bg-blue-500/5 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)] opacity-90'
              : 'border-border shadow-sm hover:border-brand-accent/50 hover:scale-[1.02]',
          )}
        >
          {data.isGhostDelete && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/50 backdrop-blur-[1px]">
              <span className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-destructive">
                Deleting
              </span>
            </div>
          )}
          {data.isGhostAdd && (
            <div className="absolute -top-2 -right-2 z-10 rounded-full bg-emerald-500 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-white shadow-sm">
              New
            </div>
          )}
          {data.isGhostUpdate && (
            <div className="absolute -top-2 -right-2 z-10 rounded-full bg-blue-500 px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-widest text-white shadow-sm">
              Update
            </div>
          )}
          <Handle
            className="!h-2.5 !w-2.5 !border-background !bg-brand-accent"
            position={Position.Left}
            type="target"
          />
          <p className="line-clamp-2 text-[0.82rem] font-medium leading-5 tracking-tight text-foreground">
            {data.label}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <DifficultyChip difficulty={data.difficulty} />
            <ConfidencePill confidence={data.confidence} />
          </div>
          <Handle
            className="!h-2.5 !w-2.5 !border-background !bg-brand-accent"
            position={Position.Right}
            type="source"
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem 
          onClick={() => data.onViewDetails?.()}
          className="cursor-pointer text-[0.82rem] font-medium leading-5 tracking-tight text-foreground"
        >
          <Info className="mr-2 size-4" /> View Details
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}, areConceptNodePropsEqual);

function areConceptNodePropsEqual(
  previous: NodeProps<Node<ConceptNodeData, 'concept'>>,
  next: NodeProps<Node<ConceptNodeData, 'concept'>>,
) {
  return (
    previous.data.confidence === next.data.confidence &&
    previous.data.difficulty === next.data.difficulty &&
    previous.data.label === next.data.label &&
    previous.data.selected === next.data.selected &&
    previous.data.isHoveredChat === next.data.isHoveredChat &&
    previous.data.isGhostAdd === next.data.isGhostAdd &&
    previous.data.isGhostUpdate === next.data.isGhostUpdate &&
    previous.data.isGhostDelete === next.data.isGhostDelete
  );
}

const nodeTypes = {
  concept: ConceptNode,
};

function FlowToolbar() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const handleFitView = useCallback(() => fitView(FIT_VIEW_OPTIONS), [fitView]);
  const handleZoomIn = useCallback(() => zoomIn(), [zoomIn]);
  const handleZoomOut = useCallback(() => zoomOut(), [zoomOut]);

  return (
    <Panel position="top-right">
      <div className="mr-3 mt-3 flex items-center gap-1 rounded-full border border-border bg-card/50 p-1 shadow-md backdrop-blur">
        <ToolbarButton label="Zoom out" onClick={handleZoomOut}>
          <Minus className="size-3.5" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton label="Zoom in" onClick={handleZoomIn}>
          <Plus className="size-3.5" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton label="Fit view" onClick={handleFitView}>
          <Expand className="size-3.5" strokeWidth={1.5} />
        </ToolbarButton>
      </div>
    </Panel>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function GraphListFallback({
  concepts,
  onSelectConcept,
  selectedConceptId,
}: {
  concepts: ConceptRow[];
  onSelectConcept: (id: string) => void;
  selectedConceptId: string | null;
}) {
  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="mb-4 flex items-center gap-2 font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
        <Network className="size-3.5 text-brand-accent-foreground" strokeWidth={1.5} />
        <span>List view · no relationships</span>
      </div>
      <p className="mb-5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
        Concepts were extracted, but the agent has not proposed relationship links yet. Review them
        as a flat list, then ask the agent to connect them.
      </p>
      <ol className="divide-y divide-border border-y border-border">
        {concepts.map((concept, index) => (
          <li key={concept.id}>
            <button aria-label="Button"  aria-current={concept.id === selectedConceptId ? 'true' : undefined}
              className={cn(
                'flex w-full items-start gap-4 py-3.5 text-left transition-colors hover:bg-card/50',
                concept.id === selectedConceptId && 'bg-brand-accent-surface',
              )}
              onClick={() => onSelectConcept(concept.id)}
              type="button"
            >
              <span className="w-8 shrink-0 font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-brand-accent-foreground">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium tracking-tight text-foreground">{concept.name}</p>
                <p className="line-clamp-2 text-[0.82rem] leading-5 text-muted-foreground">
                  {concept.definition}
                </p>
              </span>
              <span className="hidden shrink-0 items-center gap-2 sm:flex">
                <DifficultyChip difficulty={concept.difficulty} />
                <ConfidencePill confidence={concept.confidence} muted />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GraphCanvasEmpty() {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="max-w-md text-center">
        <span
          aria-hidden
          className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl border border-brand-accent-border bg-brand-accent/[0.08] text-brand-accent-foreground"
        >
          <Network className="size-5" strokeWidth={1.5} />
        </span>
        <p className="mt-4 font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
          No graph yet
        </p>
        <h3 className="mt-2 text-xl font-medium tracking-tight text-foreground">
          Generate from the current source.
        </h3>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-muted-foreground">
          Use the chat on the right to run a fresh extraction. Concepts and relationship edges will
          stream in as the agent reads the material.
        </p>
      </div>
    </div>
  );
}

function RelationChip({ label, onClick, type }: { label: string; onClick?: () => void; type?: string }) {
  const formattedType = type ? type.replace('_', ' ') : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/30 py-1 pl-2.5 pr-3 text-[0.7rem] font-medium tracking-wide text-foreground/80 transition-colors hover:bg-muted/50 hover:border-brand-accent-border/50 cursor-pointer"
    >
      {formattedType ? (
        <span className="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-muted-foreground/60">
          {formattedType}
        </span>
      ) : null}
      <span>{label}</span>
    </button>
  );
}

function ConceptDetailStrip({
  concept,
  conceptNameById,
  onSelectConcept,
  relationships,
  onViewEvidence,
}: {
  concept: ConceptRow | null;
  conceptNameById: Map<string, string>;
  onSelectConcept: (id: string) => void;
  relationships: RelationshipRow[];
  onViewEvidence: () => void;
}) {
  return (
    <div className="relative z-50 w-full border-t border-border/40 bg-card/80 backdrop-blur-xl">
      <AnimatePresence mode="wait">
        {!concept ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center justify-center w-full px-6 py-4 text-xs font-medium tracking-wide text-muted-foreground"
          >
            Select a concept to inspect its details, evidence, and relationships
          </motion.div>
        ) : (
          <motion.div
            key="selected"
            layoutId="concept-strip"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 250, damping: 25 }}
            className="w-full p-5 md:p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"
          >
            {/* Left side info */}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <DifficultyChip difficulty={concept.difficulty} />
                <ConfidencePill confidence={concept.confidence} />
              </div>
              <h3 className="text-lg md:text-xl font-medium tracking-tight text-foreground">
                {concept.name}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2 max-w-3xl">
                {concept.definition}
              </p>
              
              {/* Relationships */}
              <RelationshipsStrip concept={concept} onSelectConcept={onSelectConcept} relationships={relationships} conceptNameById={conceptNameById} />
            </div>

            {/* Right side Actions */}
            <div className="flex shrink-0 w-full md:w-auto items-center justify-between gap-6 md:flex-col md:items-end border-t md:border-t-0 md:border-l border-border/40 pt-4 md:pt-0 md:pl-6">
              <div className="flex flex-col items-start md:items-end gap-0.5 md:text-right">
                <span className="text-2xl font-light tracking-tighter text-foreground">
                  {concept.evidenceCount ?? (Array.isArray(concept.sourceEvidence) ? concept.sourceEvidence.length : 0)}
                </span>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Citations
                </span>
              </div>
              
              <Button
                variant="default"
                className="rounded-full px-6 transition-all hover:scale-105 active:scale-95 shadow-sm border border-white/5"
                onClick={onViewEvidence}
              >
                <FileText className="mr-2 size-4 opacity-70" />
                Read Evidence
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RelationshipsStrip({
  concept,
  onSelectConcept,
  relationships,
  conceptNameById,
}: {
  concept: ConceptRow;
  onSelectConcept: (id: string) => void;
  relationships: RelationshipRow[];
  conceptNameById: Map<string, string>;
}) {
  const { incoming, outgoing } = useMemo(() => {
    const incoming: RelationshipRow[] = [];
    const outgoing: RelationshipRow[] = [];

    for (const relationship of relationships) {
      if (relationship.targetConceptId === concept.id) {
        incoming.push(relationship);
      }

      if (relationship.sourceConceptId === concept.id) {
        outgoing.push(relationship);
      }
    }

    incoming.sort((a, b) => {
      const nameA = conceptNameById.get(a.sourceConceptId) ?? 'Unknown';
      const nameB = conceptNameById.get(b.sourceConceptId) ?? 'Unknown';
      return nameA.localeCompare(nameB);
    });

    outgoing.sort((a, b) => {
      const nameA = conceptNameById.get(a.targetConceptId) ?? 'Unknown';
      const nameB = conceptNameById.get(b.targetConceptId) ?? 'Unknown';
      return nameA.localeCompare(nameB);
    });

    return { incoming, outgoing };
  }, [concept.id, conceptNameById, relationships]);

  if (!incoming.length && !outgoing.length) return null;

  return (
    <div className="pt-2 flex flex-col gap-2.5">
      {incoming.length > 0 && (
        <div className="flex items-start gap-3">
          <span className="w-8 shrink-0 pt-1.5 font-mono text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground/50 text-right">In</span>
          <div className="flex flex-wrap items-center gap-2">
            {incoming.map((rel) => (
              <RelationChip key={rel.id} label={conceptNameById.get(rel.sourceConceptId) ?? 'Unknown'} type={rel.relationshipType} onClick={() => onSelectConcept(rel.sourceConceptId)} />
            ))}
          </div>
        </div>
      )}
      {outgoing.length > 0 && (
        <div className="flex items-start gap-3">
          <span className="w-8 shrink-0 pt-1.5 font-mono text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground/50 text-right">Out</span>
          <div className="flex flex-wrap items-center gap-2">
            {outgoing.map((rel) => (
              <RelationChip key={rel.id} label={conceptNameById.get(rel.targetConceptId) ?? 'Unknown'} type={rel.relationshipType} onClick={() => onSelectConcept(rel.targetConceptId)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceSkeleton() {
  return (
    <div className="flex flex-col w-full">
      <div className="h-3 w-24 bg-muted/50 rounded animate-pulse mb-8" />
      <div className="flex flex-col gap-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-col gap-3">
            <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
            <div className="h-4 w-[85%] bg-muted/40 rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted/30 rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceStack({
  evidence,
  totalCount,
}: {
  evidence: SourceEvidence[];
  totalCount: number;
}) {
  if (!evidence.length) {
    return (
      <div className="py-8 text-sm leading-relaxed text-muted-foreground/60 border-t border-border/50">
        No grounded evidence quote is attached to this concept yet.
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 20 } }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 mb-6">
        <span className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-foreground/40">
          Source Material
        </span>
        <span className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-brand-accent-foreground">
          {evidence.length} / {totalCount}
        </span>
      </div>
      
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col"
      >
        {evidence.map((item, index) => (
          <motion.blockquote
            variants={itemAnim}
            key={`${item.sourceId ?? "source"}-${item.blockId ?? index}`}
            className="group relative overflow-hidden border-l-2 border-transparent hover:border-brand-accent/50 pl-5 py-5 -ml-5 transition-all duration-300"
          >
            <div className="absolute -left-2 top-2 font-serif text-[4rem] leading-none text-brand-accent-foreground/5 opacity-0 -translate-x-4 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:opacity-10 group-hover:translate-x-0 pointer-events-none select-none">
              &ldquo;
            </div>
            <p className="relative z-10 text-[0.92rem] leading-relaxed text-foreground/80 font-medium">
              &ldquo;{item.excerpt}&rdquo;
            </p>
            
            <cite className="mt-4 flex flex-wrap items-center gap-x-3 font-mono text-[0.65rem] tabular-nums tracking-[0.1em] uppercase text-muted-foreground not-italic">
              {item.location ? <span className="text-foreground/60">§ {item.location}</span> : null}
              {item.blockId ? <span className="opacity-60">{shortenBlockId(item.blockId)}</span> : null}
            </cite>
          </motion.blockquote>
        ))}
      </motion.div>
    </div>
  );
}

function GraphCanvasSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-16 w-44 animate-pulse rounded-2xl border border-border bg-muted/30"
            />
          ))}
        </div>
        <span className="mt-2 font-mono text-[0.62rem] tracking-[0.18em] uppercase text-muted-foreground">
          Loading graph...
        </span>
      </div>
    </div>
  );
}
