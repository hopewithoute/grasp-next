'use client';

import { useMemo, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { type ConceptRow, type RelationshipRow } from '../types';
import { type ChatItem } from '../types';
import { useConceptGraphState } from '../hooks/use-concept-graph-state';
import { ConceptListPane } from './concept-list-pane';
import { GraphCanvasPane } from './graph-canvas-pane';
import { ChatPane } from './chat-pane';

type ConceptGraphWorkspaceProps = {
  concepts: ConceptRow[];
  projectId: string;
  relationships: RelationshipRow[];
};

export function ConceptGraphWorkspace(props: ConceptGraphWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <ConceptGraphEditor {...props} />
    </ReactFlowProvider>
  );
}

const ConceptGraphEditor = ({ concepts, projectId, relationships }: ConceptGraphWorkspaceProps) => {
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

  const proposalCount = pendingProposals.length;

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

  return (
    <section
      aria-label="Concept graph editor"
      className={cn(
        'grid min-h-[720px] w-full grid-cols-1 overflow-hidden rounded-[1.75rem] border border-border bg-card/50 shadow-2xl shadow-foreground/5 lg:h-[min(calc(100dvh-320px),920px)] lg:min-h-0',
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
      <ConceptListPane
        projectId={projectId}
        collapsed={isInventoryCollapsed}
        concepts={concepts}
        onCollapseToggle={handleInventoryCollapseToggle}
        onSelectConcept={handleSelectConcept}
        relationshipsCount={relationships.length}
        selectedConceptId={selectedConceptId}
      />

      <GraphCanvasPane
        projectId={projectId}
        concepts={concepts}
        isRunning={isRunning}
        onSelectConcept={handleSelectConcept}
        proposalCount={proposalCount}
        relationships={relationships}
        selectedConcept={selectedConcept}
        conceptNameById={conceptNameById}
        hoveredChatConceptId={hoveredChatConceptId}
        pendingProposals={pendingProposals}
      />

      <ChatPane
        key={projectId}
        collapsed={isRefinementCollapsed}
        items={items}
        onCollapseToggle={handleRefinementCollapseToggle}
        projectId={projectId}
        chatContextConcepts={chatContextConcepts}
        onRemoveChatContext={handleRemoveChatContext}
        onHoverChatContext={setHoveredChatConceptId}
        onPendingProposalsChange={setPendingProposals}
      />
    </section>
  );
};
