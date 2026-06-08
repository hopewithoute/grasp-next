'use client';

import { useCallback, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { LayoutGrid, Network } from 'lucide-react';
import type { ProjectSourceRecord } from '@grasp/domain';
import { cn } from '@/lib/utils';
import { executeGraphProposalAction } from '../../actions';
import { useConceptGraphState } from '../hooks/use-concept-graph-state';
import { PendingProposalsContext } from '../hooks/use-pending-proposals-context';
import { type ChatItem, type ConceptRow, type RelationshipRow } from '../types';
import { ChatPane } from './chat-pane';
import { ConceptDataGridPane } from './concept-data-grid-pane';
import { GraphCanvasPane } from './graph-canvas-pane';
import { LibraryPane } from './library-pane';

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

  return (
    <PendingProposalsContext.Provider value={pendingProposalsValue}>
      <section
        aria-label="Concept graph editor"
        className={cn(
          'border-border bg-card/50 shadow-foreground/5 grid min-h-[720px] w-full grid-cols-1 overflow-hidden rounded-[1.75rem] border shadow-2xl lg:h-[min(calc(100dvh-320px),920px)] lg:min-h-0',
          !isInventoryCollapsed &&
            !isRefinementCollapsed &&
            'lg:grid-cols-[20rem_minmax(0,1fr)_28rem] xl:grid-cols-[22rem_minmax(0,1fr)_30rem]',
          isInventoryCollapsed &&
            !isRefinementCollapsed &&
            'lg:grid-cols-[4rem_minmax(0,1fr)_28rem] xl:grid-cols-[4rem_minmax(0,1fr)_30rem]',
          !isInventoryCollapsed &&
            isRefinementCollapsed &&
            'lg:grid-cols-[20rem_minmax(0,1fr)_4rem] xl:grid-cols-[22rem_minmax(0,1fr)_4rem]',
          isInventoryCollapsed && isRefinementCollapsed && 'lg:grid-cols-[4rem_minmax(0,1fr)_4rem]'
        )}
      >
        <LibraryPane
          projectId={projectId}
          collapsed={isInventoryCollapsed}
          onCollapseToggle={handleInventoryCollapseToggle}
          sources={sources}
        />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* View Toggle */}
          <div className="border-border bg-card-surface/50 absolute top-4 right-4 z-10 flex rounded-full border p-1 shadow-sm backdrop-blur-md">
            <button
              onClick={() => setViewMode('graph')}
              title="Graph View"
              className={cn(
                'flex size-8 items-center justify-center rounded-full transition-all',
                viewMode === 'graph'
                  ? 'bg-brand-accent text-brand-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <Network className="size-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={cn(
                'flex size-8 items-center justify-center rounded-full transition-all',
                viewMode === 'list'
                  ? 'bg-brand-accent text-brand-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>

          {viewMode === 'graph' ? (
            <GraphCanvasPane
              projectId={projectId}
              concepts={concepts}
              isRunning={isRunning}
              onSelectConcept={handleSelectConcept}
              relationships={relationships}
              selectedConcept={selectedConcept}
              conceptNameById={conceptNameById}
              hoveredChatConceptId={hoveredChatConceptId}
              onAcceptProposal={handleAcceptProposal}
              onRejectProposal={handleRejectProposal}
            />
          ) : (
            <ConceptDataGridPane
              projectId={projectId}
              concepts={concepts}
              relationships={relationships}
              onSelectConcept={handleSelectConcept}
              selectedConceptId={selectedConceptId}
            />
          )}
        </div>

        <ChatPane
          key={projectId}
          collapsed={isRefinementCollapsed}
          items={items}
          onCollapseToggle={handleRefinementCollapseToggle}
          projectId={projectId}
          chatContextConcepts={chatContextConcepts}
          onRemoveChatContext={handleRemoveChatContext}
          onHoverChatContext={setHoveredChatConceptId}
        />
      </section>
    </PendingProposalsContext.Provider>
  );
};
