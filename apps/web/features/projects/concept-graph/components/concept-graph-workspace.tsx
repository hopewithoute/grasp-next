'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReactFlowProvider } from '@xyflow/react';
import { Database, FileText, Maximize, Minimize, Network, Search, Wand2 } from 'lucide-react';
import type { IngestionRunRecord, ProjectSourceRecord } from '@grasp/domain';
import { cn } from '@/lib/utils';
import { useConceptGraphState } from '../hooks/use-concept-graph-state';
import { PendingProposalsContext } from '../hooks/use-pending-proposals-context';
import { type ChatItem, type ConceptRow, type RelationshipRow } from '../types';
import { ChatPane } from './chat-pane';
import { EvidenceExplorerPane } from './evidence-explorer-pane';
import { GraphCanvasPane } from './graph-canvas-pane';
import { LibraryPane } from './library-pane';
import { TestRetrievalPane } from './test-retrieval-pane';

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
  ingestionRuns?: IngestionRunRecord[];
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
  ingestionRuns = [],
}: ConceptGraphWorkspaceProps) => {
  const router = useRouter();
  const {
    pendingSelectedId,
    setPendingSelectedId,
    chatContextConceptIds,
    setChatContextConceptIds,
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

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

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
    (proposalId: string) => {
      setPendingProposals((current) => current.filter((p) => p.id !== proposalId));
    },
    [setPendingProposals]
  );

  const handleRejectProposal = useCallback(
    (proposalId: string) => {
      setPendingProposals((current) => current.filter((p) => p.id !== proposalId));
    },
    [setPendingProposals]
  );

  const pendingProposalsValue = useMemo(() => ({ pendingProposals }), [pendingProposals]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const isIngestionRunning = useMemo(
    () => ingestionRuns.some((run) => run.status === 'ingesting'),
    [ingestionRuns]
  );

  const handleActivityOpenChange = useCallback(
    (open: boolean) => {
      setIsActivityOpen(open);
      if (open) {
        router.refresh();
      }
    },
    [router]
  );

  return (
    <PendingProposalsContext.Provider value={pendingProposalsValue}>
      <section
        aria-label="Concept graph editor"
        className={cn(
          'bg-background/50 flex overflow-hidden shadow-[0_0_30px_rgba(230,92,0,0.05)] transition-all duration-300',
          isFullscreen
            ? 'bg-background fixed inset-0 z-[100] !m-0 h-[100dvh] min-h-[100dvh] w-[100dvw] !rounded-none border-none'
            : 'border-brand-accent/30 h-[75vh] min-h-[600px] w-full border lg:min-h-0'
        )}
      >
        {/* View Toggle defined once to pass into pane headers */}
        {(() => {
          const viewToggleNode = (
            <div className="ml-2 flex border p-0.5 shadow-sm">
              <button
                onClick={() => setViewMode('evidence')}
                title="Knowledge Base"
                className={getViewToggleButtonStyles(viewMode === 'evidence')}
              >
                <Database className="size-3" />[ KNOWLEDGE_BASE ]
              </button>
              <button
                onClick={() => setViewMode('retrieval')}
                title="Test Retrieval"
                className={getViewToggleButtonStyles(viewMode === 'retrieval')}
              >
                <Search className="size-3" />[ TEST_RETRIEVAL ]
              </button>
              <button
                onClick={() => setViewMode('graph')}
                title="Graph View"
                className={getViewToggleButtonStyles(viewMode === 'graph')}
              >
                <Network className="size-3" />[ GRAPH ]
              </button>
              <button
                onClick={() => setViewMode('refinement')}
                title="Refinement"
                className={getViewToggleButtonStyles(viewMode === 'refinement')}
              >
                <Wand2 className="size-3" />[ REFINEMENT ]
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
              ) : viewMode === 'retrieval' ? (
                <TestRetrievalPane projectId={projectId} viewToggle={viewToggleNode} />
              ) : viewMode === 'evidence' ? (
                <div className="grid min-h-0 flex-1 grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]">
                  <LibraryPane
                    projectId={projectId}
                    isActivityOpen={isActivityOpen}
                    isRunning={isIngestionRunning}
                    onActivityOpenChange={handleActivityOpenChange}
                    sources={sources}
                    ingestionRuns={ingestionRuns}
                    selectedSourceId={selectedSourceId}
                    onSelectSource={setSelectedSourceId}
                  />
                  <EvidenceExplorerPane
                    projectId={projectId}
                    viewToggle={viewToggleNode}
                    externalSelectedSourceId={selectedSourceId}
                    onSelectSource={setSelectedSourceId}
                    sources={sources}
                  />
                </div>
              ) : (
                <ChatPane
                  key={projectId}
                  items={items}
                  onActivityOpenChange={handleActivityOpenChange}
                  projectId={projectId}
                  chatContextConcepts={chatContextConcepts}
                  onRemoveChatContext={handleRemoveChatContext}
                  onHoverChatContext={setHoveredChatConceptId}
                  viewToggle={viewToggleNode}
                />
              )}
            </div>
          );
        })()}
      </section>
    </PendingProposalsContext.Provider>
  );
};
