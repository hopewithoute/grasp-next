'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReactFlowProvider } from '@xyflow/react';
import { FileText, LayoutGrid, Maximize, Minimize, Network } from 'lucide-react';
import type { ProjectSourceRecord } from '@grasp/domain';
import { consumeUIMessageChunks } from '@/lib/ui-message-stream';
import { cn } from '@/lib/utils';
import { executeGraphProposalAction } from '../../actions';
import {
  type FeedItem,
  type IngestionStreamEvent,
} from '../../components/ingestion-activity-panel';
import { useConceptGraphState } from '../hooks/use-concept-graph-state';
import { PendingProposalsContext } from '../hooks/use-pending-proposals-context';
import { type ChatItem, type ConceptRow, type RelationshipRow } from '../types';
import { ChatPane } from './chat-pane';
import { ConceptDataGridPane } from './concept-data-grid-pane';
import { EvidenceExplorerPane } from './evidence-explorer-pane';
import { GraphCanvasPane } from './graph-canvas-pane';
import { LibraryPane } from './library-pane';

function getWorkspaceGridColumns(inventoryCollapsed: boolean, refinementCollapsed: boolean) {
  if (inventoryCollapsed && refinementCollapsed) return 'lg:grid-cols-[4rem_minmax(0,1fr)_4rem]';
  if (inventoryCollapsed && !refinementCollapsed)
    return 'lg:grid-cols-[4rem_minmax(0,1fr)_24rem] xl:grid-cols-[4rem_minmax(0,1fr)_28rem]';
  if (!inventoryCollapsed && refinementCollapsed)
    return 'lg:grid-cols-[22rem_minmax(0,1fr)_4rem] xl:grid-cols-[26rem_minmax(0,1fr)_4rem]';
  return 'lg:grid-cols-[22rem_minmax(0,1fr)_24rem] xl:grid-cols-[26rem_minmax(0,1fr)_28rem]';
}

function getViewToggleButtonStyles(isActive: boolean) {
  return cn(
    'flex h-8 items-center justify-center gap-2 px-3 font-mono text-[0.65rem] tracking-widest uppercase transition-all border',
    isActive
      ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/50 shadow-sm'
      : 'text-muted-foreground/70 hover:text-foreground hover:border-border/50 border-transparent'
  );
}

type ConceptGraphWorkspaceProps = {
  concepts: ConceptRow[];
  projectId: string;
  relationships: RelationshipRow[];
  sources?: ProjectSourceRecord[];
};

export function ConceptGraphWorkspace(props: ConceptGraphWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <ConceptGraphEditor {...props} />
    </ReactFlowProvider>
  );
}

const ConceptGraphEditor = ({
  concepts,
  projectId,
  relationships,
  sources = [],
}: ConceptGraphWorkspaceProps) => {
  const router = useRouter();
  const {
    pendingSelectedId,
    setPendingSelectedId,
    chatContextConceptIds,
    setChatContextConceptIds,
    isInventoryCollapsed,
    setIsInventoryCollapsed,
    isRefinementCollapsed,
    setIsRefinementCollapsed,
    hoveredChatConceptId,
    setHoveredChatConceptId,
    pendingProposals,
    setPendingProposals,
    viewMode,
    setViewMode,
    isFullscreen,
    setIsFullscreen,
  } = useConceptGraphState(concepts);

  const items = useMemo<ChatItem[]>(
    () => [
      {
        id: 'agent-ready',
        kind: 'message',
        role: 'agent',
        text: concepts.length
          ? 'Concept graph is open. Edit a source on the left to rebuild the graph; ingestion runs automatically when you save a source.'
          : 'Add a source on the left to build the concept graph. Ingestion runs automatically when you save a source.',
      },
    ],
    [concepts.length]
  );

  const conceptById = useMemo(
    () => new Map(concepts.map((concept) => [concept.id, concept])),
    [concepts]
  );

  const selectedConceptId = useMemo(() => {
    if (!concepts.length) return null;
    if (pendingSelectedId && conceptById.has(pendingSelectedId)) {
      return pendingSelectedId;
    }
    return concepts[0]?.id ?? null;
  }, [conceptById, concepts, pendingSelectedId]);

  const handleSelectConcept = useCallback(
    (id: string, isContextAction?: boolean) => {
      if (isContextAction) {
        setChatContextConceptIds((prev: string[]) =>
          prev.includes(id) ? prev.filter((cId: string) => cId !== id) : [...prev, id]
        );
      } else {
        setPendingSelectedId(id);
      }
    },
    [setChatContextConceptIds, setPendingSelectedId]
  );

  const chatContextConcepts = useMemo(() => {
    const contextIds = new Set(chatContextConceptIds);
    return concepts.filter((concept) => contextIds.has(concept.id));
  }, [concepts, chatContextConceptIds]);

  const conceptNameById = useMemo(
    () => new Map(concepts.map((concept) => [concept.id, concept.name])),
    [concepts]
  );

  const selectedConcept = useMemo(
    () => (selectedConceptId ? (conceptById.get(selectedConceptId) ?? null) : null),
    [conceptById, selectedConceptId]
  );

  const isRunning = false;
  const handleInventoryCollapseToggle = useCallback(() => {
    setIsInventoryCollapsed((current: boolean) => !current);
  }, [setIsInventoryCollapsed]);
  const handleRefinementCollapseToggle = useCallback(() => {
    setIsRefinementCollapsed((current: boolean) => !current);
  }, [setIsRefinementCollapsed]);
  const handleRemoveChatContext = useCallback(
    (id: string) => {
      setChatContextConceptIds((current: string[]) =>
        current.filter((conceptId) => conceptId !== id)
      );
    },
    [setChatContextConceptIds]
  );

  const handleAcceptProposal = useCallback(
    async (proposalId: string) => {
      const proposal = pendingProposals.find((p) => p.id === proposalId);
      if (!proposal) return;

      // Optimistically remove from state
      setPendingProposals((current) => current.filter((p) => p.id !== proposalId));

      try {
        await executeGraphProposalAction(projectId, proposal.actions);
      } catch (error) {
        console.error('Failed to accept proposal', error);
        // On error, we could add it back to state, but for MVP just log it
      }
    },
    [pendingProposals, projectId, setPendingProposals]
  );

  const handleRejectProposal = useCallback(
    (proposalId: string) => {
      setPendingProposals((current) => current.filter((p) => p.id !== proposalId));
    },
    [setPendingProposals]
  );

  const pendingProposalsValue = useMemo(() => ({ pendingProposals }), [pendingProposals]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isIngestionRunning, setIsIngestionRunning] = useState(false);
  const [ingestionFeed, setIngestionFeed] = useState<FeedItem[]>([]);

  const handleIngestionTrigger = useCallback(
    async (sourceId: string, sourceTitle: string, sourceType: string, content: string) => {
      setIsIngestionRunning(true);
      setIngestionFeed([]);
      setIsActivityOpen(true);

      const response = await fetch(`/api/v1/projects/${projectId}/ingestion/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, sourceTitle, sourceType, content }),
      });

      if (!response.ok || !response.body) {
        setIsIngestionRunning(false);
        setIngestionFeed((feed) => [
          ...feed,
          {
            id: `err-${Date.now()}`,
            event: { type: 'ingestion_failed', reason: 'Request failed' },
          },
        ]);
        return;
      }

      let hasError = false;

      await consumeUIMessageChunks(response.body, (chunk) => {
        if (chunk.type === 'data-ingestion') {
          const event = chunk.data as IngestionStreamEvent;
          if (event.type === 'ingestion_failed') hasError = true;
          setIngestionFeed((feed) => [
            ...feed,
            { id: `${event.type}-${Date.now()}-${feed.length}`, event },
          ]);
        }
      });

      setIsIngestionRunning(false);
      router.refresh();

      if (!hasError) {
        setTimeout(() => setIsActivityOpen(false), 1200);
      }
    },
    [projectId, router]
  );

  return (
    <PendingProposalsContext.Provider value={pendingProposalsValue}>
      <section
        aria-label="Concept graph editor"
        className={cn(
          'bg-background/50 grid overflow-hidden shadow-[0_0_30px_rgba(230,92,0,0.05)] transition-all duration-300',
          isFullscreen
            ? 'bg-background fixed inset-0 z-[100] !m-0 h-[100dvh] min-h-[100dvh] w-[100dvw] !rounded-none border-none'
            : 'border-brand-accent/30 h-[75vh] min-h-[600px] w-full border lg:min-h-0',
          getWorkspaceGridColumns(isInventoryCollapsed, isRefinementCollapsed)
        )}
      >
        <LibraryPane
          projectId={projectId}
          collapsed={isInventoryCollapsed}
          feed={ingestionFeed}
          isActivityOpen={isActivityOpen}
          isRunning={isIngestionRunning}
          onCollapseToggle={handleInventoryCollapseToggle}
          onIngestionTrigger={handleIngestionTrigger}
          onActivityOpenChange={setIsActivityOpen}
          sources={sources}
        />

        {/* View Toggle defined once to pass into pane headers */}
        {(() => {
          const viewToggleNode = (
            <div className="flex border p-0.5 ml-2 shadow-sm">
              <button
                onClick={() => setViewMode('evidence')}
                title="Evidence View"
                className={getViewToggleButtonStyles(viewMode === 'evidence')}
              >
                <FileText className="size-3" />[ EVIDENCE ]
              </button>
              <button
                onClick={() => setViewMode('graph')}
                title="Graph View"
                className={getViewToggleButtonStyles(viewMode === 'graph')}
              >
                <Network className="size-3" />[ GRAPH ]
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="List View"
                className={getViewToggleButtonStyles(viewMode === 'list')}
              >
                <LayoutGrid className="size-3" />[ TABLE ]
              </button>
              <div className="bg-border/40 mx-1 my-1 w-px" />
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                className={getViewToggleButtonStyles(false)}
              >
                {isFullscreen ? (
                  <>
                    <Minimize className="size-3" />[ EXIT ]
                  </>
                ) : (
                  <>
                    <Maximize className="size-3" />[ EXPAND ]
                  </>
                )}
              </button>
            </div>
          );

          return (
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              {viewMode === 'graph' ? (
                <GraphCanvasPane
                  projectId={projectId}
                  concepts={concepts}
                  conceptNameById={conceptNameById}
                  isRunning={isRunning}
                  onSelectConcept={handleSelectConcept}
                  relationships={relationships}
                  selectedConcept={selectedConcept}
                  hoveredChatConceptId={hoveredChatConceptId}
                  onAcceptProposal={handleAcceptProposal}
                  onRejectProposal={handleRejectProposal}
                  viewToggle={viewToggleNode}
                />
              ) : viewMode === 'evidence' ? (
                <EvidenceExplorerPane projectId={projectId} viewToggle={viewToggleNode} />
              ) : (
                <ConceptDataGridPane
                  projectId={projectId}
                  concepts={concepts}
                  relationships={relationships}
                  onSelectConcept={handleSelectConcept}
                  selectedConceptId={selectedConcept?.id ?? null}
                  viewToggle={viewToggleNode}
                />
              )}
            </div>
          );
        })()}

        <ChatPane
          key={projectId}
          collapsed={isRefinementCollapsed}
          items={items}
          onCollapseToggle={handleRefinementCollapseToggle}
          onIngestionTrigger={handleIngestionTrigger}
          projectId={projectId}
          chatContextConcepts={chatContextConcepts}
          onRemoveChatContext={handleRemoveChatContext}
          onHoverChatContext={setHoveredChatConceptId}
        />
      </section>
    </PendingProposalsContext.Provider>
  );
};
