'use client';

/**
 * Concept Graph Editor — three-pane chat workspace.
 *
 *   ┌──────────────┬──────────────────────────────┬──────────────────┐
 *   │  Concepts    │   Graph canvas               │   Refinement     │
 *   │  (filterable │   (React Flow + selection    │   chat (events,  │
 *   │   list)      │    detail strip)             │   composer)      │
 *   └──────────────┴──────────────────────────────┴──────────────────┘
 *
 * Brand alignment: Dark Studio + Mint Foil. Hairlines over cards. Mono numerals.
 * Eyebrow + accent dot per pane. No emojis. lucide-react icons only.
 */

import {
  Background,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { cva } from 'class-variance-authority';

import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronsLeft,
  ChevronsRight,
  CircleDashed,
  Expand,
  FileText,
  GitBranch,
  Info,
  ListFilter,
  MessageSquareText,
  Minus,
  Network,
  Plus,
  Quote,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useCallback,
  useReducer,
  useLayoutEffect,
} from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { consumeUIMessageChunks } from '@/lib/ui-message-stream';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  updateKnowledgebaseConceptFormAction,
  updateKnowledgebaseEvidenceFormAction,
  updateKnowledgebaseRelationshipEvidenceFormAction,
  updateKnowledgebaseRelationshipFormAction,
  searchKnowledgebaseConceptsAction,
} from './actions';
import { artifactStatusVariant } from './project-style-variants';
import { type ConceptGraphArtifact, type ConceptRow, type RelationshipRow } from './concept-graph-view';
import { buildConceptGraph } from './concept-graph-utils';// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

type ConceptGraphWorkspaceProps = {
  artifact: ConceptGraphArtifact;
  concepts: ConceptRow[];
  projectId: string;
  relationships: RelationshipRow[];
  sources: Array<{
    content: string | null;
    id: string;
    title: string;
    type: string;
  }>;
};

export function ConceptGraphWorkspace(props: ConceptGraphWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <ConceptGraphEditor {...props} />
    </ReactFlowProvider>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Domain types
// ───────────────────────────────────────────────────────────────────────────

type DifficultyFilter = 'all' | ConceptRow['difficulty'];

type WorkspaceEvent =
  | { type: 'assistant_message'; text: string }
  | { type: 'source_read'; sourceId: string; title?: string }
  | { type: 'concept_proposed'; name: string; definition?: string }
  | {
      type: 'relationship_proposed';
      source: string;
      target: string;
      relationshipType: string;
    }
  | { type: 'evidence_attached'; concept: string; excerpt: string; location?: string }
  | { type: 'ingestion_complete'; conceptCount: number; relationshipCount: number }
  | { type: 'agent_activity'; label: string; detail: string; status?: 'started' | 'completed' };

type StreamEvent = Exclude<WorkspaceEvent, { type: 'assistant_message' }>;

type ChatItem =
  | {
      id: string;
      kind: 'message';
      role: 'agent' | 'user';
      streaming?: boolean;
      text: string;
    }
  | {
      id: string;
      kind: 'event';
      event: StreamEvent;
    };

type ConceptNodeData = {
  confidence: string;
  difficulty: ConceptRow['difficulty'];
  label: string;
  selected: boolean;
};

// ───────────────────────────────────────────────────────────────────────────
// Editor shell
// ───────────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// eslint-disable-next-line react-doctor/prefer-useReducer

type SetStateAction<S> = S | ((prevState: S) => S);

function useConceptGraphState(concepts: ConceptRow[]) {
  const [state, dispatch] = useReducer((state: any, action: any) => {
    const newState = { ...state };
    for (const key in action) {
      if (typeof action[key] === 'function') {
        newState[key] = action[key](state[key]);
      } else {
        newState[key] = action[key];
      }
    }
    return newState;
  }, {
    pendingSelectedId: concepts[0]?.id ?? null,
    chatContextConceptIds: [],
    searchQuery: '',
    difficultyFilter: 'all',
    isInventoryCollapsed: true,
    isRefinementCollapsed: false,
    serverConcepts: concepts || [],
    hasMore: true,
    isLoadingMore: false,
  });

  const setPendingSelectedId = useCallback((val: any) => dispatch({ pendingSelectedId: val }), []);
  const setChatContextConceptIds = useCallback((val: SetStateAction<string[]>) => dispatch({ chatContextConceptIds: val }), []);
  const setSearchQuery = useCallback((val: SetStateAction<string>) => dispatch({ searchQuery: val }), []);
  const setDifficultyFilter = useCallback((val: SetStateAction<string>) => dispatch({ difficultyFilter: val }), []);
  const setIsInventoryCollapsed = useCallback((val: SetStateAction<boolean>) => dispatch({ isInventoryCollapsed: val }), []);
  const setIsRefinementCollapsed = useCallback((val: SetStateAction<boolean>) => dispatch({ isRefinementCollapsed: val }), []);
  const setServerConcepts = useCallback((val: SetStateAction<ConceptRow[]>) => dispatch({ serverConcepts: val }), []);
  const setHasMore = useCallback((val: SetStateAction<boolean>) => dispatch({ hasMore: val }), []);
  const setIsLoadingMore = useCallback((val: SetStateAction<boolean>) => dispatch({ isLoadingMore: val }), []);

  return {
    ...state,
    setPendingSelectedId,
    setChatContextConceptIds,
    setSearchQuery,
    setDifficultyFilter,
    setIsInventoryCollapsed,
    setIsRefinementCollapsed,
    setServerConcepts,
    setHasMore,
    setIsLoadingMore
  };
}

const ConceptGraphEditor = ({
  artifact,
  concepts,
  projectId,
  relationships,
  sources,
}: ConceptGraphWorkspaceProps) => {
  // Selection is stored as the user's *intent* and resolved during render against
  // the current concept list. This keeps state valid across server refreshes
  // (post-stream) without needing a setState-in-effect dance.
  const {
    pendingSelectedId, setPendingSelectedId,
    chatContextConceptIds, setChatContextConceptIds,
    searchQuery, setSearchQuery,
    difficultyFilter, setDifficultyFilter,
    isInventoryCollapsed, setIsInventoryCollapsed,
    isRefinementCollapsed, setIsRefinementCollapsed,
    serverConcepts, setServerConcepts,
    hasMore, setHasMore,
    isLoadingMore, setIsLoadingMore
  } = useConceptGraphState(concepts);
  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  const fetchConcepts = useCallback(async (query: string, difficulty: DifficultyFilter, offset: number, replace = false) => {
    setIsLoadingMore(true);
    try {
      const result = await searchKnowledgebaseConceptsAction({
        projectId,
        query,
        difficulty: difficulty === 'all' ? undefined : difficulty,
        offset,
        limit: 5,
      });
      
      setServerConcepts((prev: any) => {
        if (replace) return result.concepts;
        
        const existingIds = new Set(prev.map((c: any) => c.id));
        const newConcepts = result.concepts.filter(c => !existingIds.has(c.id));
        return [...prev, ...newConcepts];
      });
      setHasMore(result.concepts.length === 5);
    } catch (error) {
      console.error('Failed to fetch concepts', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [projectId, setIsLoadingMore, setServerConcepts, setHasMore]);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConcepts(debouncedSearchQuery, difficultyFilter, 0, true);
  }, [debouncedSearchQuery, difficultyFilter, fetchConcepts]);

  const loadMoreConcepts = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    fetchConcepts(debouncedSearchQuery, difficultyFilter, serverConcepts.length, false);
  }, [hasMore, isLoadingMore, fetchConcepts, debouncedSearchQuery, difficultyFilter, serverConcepts.length]);

  const items = useMemo<ChatItem[]>(
    () => [
      {
        id: 'agent-ready',
        kind: 'message',
        role: 'agent',
        text: artifact
          ? 'Concept graph is open. Edit a source on the left to rebuild the graph; ingestion runs automatically when you save a source.'
          : 'Add a source on the left to build the concept graph. Ingestion runs automatically when you save a source.',
      },
    ],
    [artifact],
  );

  const selectedConceptId = useMemo(() => {
    if (!concepts.length) return null;
    if (pendingSelectedId && concepts.some((concept) => concept.id === pendingSelectedId)) {
      return pendingSelectedId;
    }
    return concepts[0]?.id ?? null;
  }, [concepts, pendingSelectedId]);
  const handleSelectConcept = useCallback((id: string, isContextAction?: boolean) => {
    if (isContextAction) {
      setChatContextConceptIds((prev: any) => 
        prev.includes(id) ? prev.filter((cId: any) => cId !== id) : [...prev, id]
      );
    } else {
      setPendingSelectedId(id);
    }
  }, [setChatContextConceptIds, setPendingSelectedId]);

  const chatContextConcepts = useMemo(() => 
    concepts.filter(c => chatContextConceptIds.includes(c.id)),
  [concepts, chatContextConceptIds]);

  const filteredConcepts = serverConcepts;

  const conceptNameById = useMemo(
    () => new Map(concepts.map((concept) => [concept.id, concept.name])),
    [concepts],
  );

  const selectedConcept = useMemo(
    () => concepts.find((concept) => concept.id === selectedConceptId) ?? null,
    [concepts, selectedConceptId],
  );

  const proposalCount = useMemo(
    () =>
      items.reduce(
        (count, item) => (item.kind === 'event' && item.event.type === 'concept_proposed' ? count + 1 : count),
        0,
      ),
    [items],
  );

  const sourceReady = sources.some((source) => source.content?.trim());
  const sourceWords = useMemo(() => {
    const trimmed = sources
      .flatMap((source) => {
        const val = source.content?.trim();
        return val ? [val] : [];
      })
      .join('\n');
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [sources]);

  const isRunning = false;

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
        isInventoryCollapsed &&
          isRefinementCollapsed &&
          'lg:grid-cols-[4rem_minmax(0,1fr)_4rem]',
      )}
    >
      <ConceptListPane
        collapsed={isInventoryCollapsed}
        concepts={concepts}
        difficultyFilter={difficultyFilter}
        filteredConcepts={filteredConcepts}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onCollapseToggle={() => setIsInventoryCollapsed((current: any) => !current)}
        onDifficultyFilterChange={setDifficultyFilter}
        onLoadMore={loadMoreConcepts}
        onSearchQueryChange={setSearchQuery}
        onSelectConcept={handleSelectConcept}
        relationshipsCount={relationships.length}
        searchQuery={searchQuery}
        selectedConceptId={selectedConceptId}
      />

      <GraphCanvasPane
        artifact={artifact}
        concepts={concepts}
        isRunning={isRunning}
        onSelectConcept={handleSelectConcept}
        proposalCount={proposalCount}
        relationships={relationships}
        selectedConcept={selectedConcept}
        conceptNameById={conceptNameById}
      />

      <ChatPane
        collapsed={isRefinementCollapsed}
        items={items}
        onCollapseToggle={() => setIsRefinementCollapsed((current: any) => !current)}
        projectId={projectId}
        chatContextConcepts={chatContextConcepts}
        onRemoveChatContext={(id) => setChatContextConceptIds((prev: any) => prev.filter((c: any) => c !== id))}
        sourceReady={sourceReady}
        sourceWords={sourceWords}
      />
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Pane: Concepts (left)
// ───────────────────────────────────────────────────────────────────────────

const DIFFICULTY_FILTER_ORDER: DifficultyFilter[] = ['all', 'beginner', 'intermediate', 'advanced'];

const DIFFICULTY_FILTER_LABEL: Record<DifficultyFilter, string> = {
  advanced: 'Advanced',
  all: 'All',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
};

function ConceptListPane({
  collapsed,
  concepts,
  difficultyFilter,
  filteredConcepts,
  hasMore,
  isLoadingMore,
  onCollapseToggle,
  onDifficultyFilterChange,
  onLoadMore,
  onSearchQueryChange,
  onSelectConcept,
  relationshipsCount,
  searchQuery,
  selectedConceptId,
}: {
  collapsed: boolean;
  concepts: ConceptRow[];
  difficultyFilter: DifficultyFilter;
  filteredConcepts: ConceptRow[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onCollapseToggle: () => void;
  onDifficultyFilterChange: (value: DifficultyFilter) => void;
  onLoadMore?: () => void;
  onSearchQueryChange: (value: string) => void;
  onSelectConcept: (id: string) => void;
  relationshipsCount: number;
  searchQuery: string;
  selectedConceptId: string | null;
}) {
  const searchInputId = useId();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoadingMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { root: null, rootMargin: '100px', threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (collapsed) {
    return (
      <CollapsedPaneRail
        ariaLabel="Expand concept inventory"
        eyebrow="Concepts"
        meta={`${filteredConcepts.length}/${concepts.length}`}
        onToggle={onCollapseToggle}
        side="left"
        title="Inventory"
      />
    );
  }

  return (
    <aside
      aria-label="Concepts"
      className="flex min-h-[520px] flex-col border-b border-border bg-card lg:min-h-0 lg:border-b-0 lg:border-r"
    >
      <PaneHeader
        eyebrow="Concepts"
        meta={
          <span className="font-mono tabular-nums text-muted-foreground">
            {String(filteredConcepts.length).padStart(2, '0')} / {String(concepts.length).padStart(2, '0')}
          </span>
        }
        onCollapseToggle={onCollapseToggle}
        side="left"
        title="Inventory"
      />

      <div className="space-y-3 px-4 pb-3">
        <label className="sr-only" htmlFor={searchInputId}>
          Search concepts
        </label>
        <div className="flex h-9 items-center gap-2 rounded-full border border-border bg-card/50 px-3 transition-colors focus-within:border-brand-accent-border focus-within:bg-card/50">
          <Search className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <input aria-label="Input field"  className="flex-1 border-0 bg-transparent text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
            id={searchInputId}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search concept or definition"
            type="search"
            value={searchQuery}
          />
        </div>

        {/* eslint-disable-next-line react-doctor/prefer-tag-over-role */}
        <div role="group" aria-label="Difficulty filter" className="flex flex-wrap gap-1.5">
          {DIFFICULTY_FILTER_ORDER.map((value) => (
            <button aria-label="Button"  aria-pressed={difficultyFilter === value}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.7rem] font-medium tracking-wide transition-colors',
                difficultyFilter === value
                  ? 'border-brand-accent-border bg-brand-accent-surface text-foreground'
                  : 'border-border bg-card/50 text-muted-foreground hover:border-border hover:text-foreground',
              )}
              key={value}
              onClick={() => onDifficultyFilterChange(value)}
              type="button"
            >
              {value === 'all' ? (
                <ListFilter className="size-3" strokeWidth={1.5} />
              ) : (
                <span aria-hidden className="size-1.5 rounded-full bg-brand-accent" />
              )}
              {DIFFICULTY_FILTER_LABEL[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredConcepts.length === 0 ? (
          <ConceptListEmpty hasConcepts={concepts.length > 0} />
        ) : (
          <>
            <ol className="divide-y divide-border border-y border-border">
              {filteredConcepts.map((concept, index) => (
                <li key={concept.id}>
                  <ConceptListItem
                    active={concept.id === selectedConceptId}
                    concept={concept}
                    index={index + 1}
                    onSelect={onSelectConcept}
                  />
                </li>
              ))}
            </ol>
            <div ref={loadMoreRef} className="flex h-16 items-center justify-center">
              {isLoadingMore ? (
                <span className="font-mono text-xs text-muted-foreground">Loading…</span>
              ) : hasMore ? (
                <button aria-label="Button"  type="button"
                  onClick={onLoadMore}
                  className="font-mono text-xs text-brand-accent-foreground hover:text-brand-accent-foreground"
                >
                  Load More
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 font-mono text-[0.62rem] tabular-nums tracking-[0.16em] uppercase text-muted-foreground">
        <span>{String(concepts.length).padStart(2, '0')} concepts</span>
        <span aria-hidden className="text-muted-foreground">·</span>
        <span>{String(relationshipsCount).padStart(2, '0')} relationships</span>
      </footer>
    </aside>
  );
}

const conceptListItemVariants = cva(
  'group relative flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors',
  {
    defaultVariants: { active: false },
    variants: {
      active: {
        false: 'bg-transparent hover:bg-card/50',
        true: 'bg-brand-accent-surface',
      },
    },
  },
);

function ConceptListItem({
  active,
  concept,
  index,
  onSelect,
}: {
  active: boolean;
  concept: ConceptRow;
  index: number;
  onSelect: (id: string, multi?: boolean) => void;
}) {
  return (
    <button aria-label="Button"  aria-current={active ? 'true' : undefined}
      className={conceptListItemVariants({ active })}
      onClick={(e) => onSelect(concept.id, e.ctrlKey || e.metaKey || e.shiftKey)}
      type="button"
    >
      {active ? (
        <span
          aria-hidden
          className="absolute top-3 bottom-3 left-0 w-[2px] rounded-full bg-brand-accent"
        />
      ) : null}
      <div className="flex items-center justify-between gap-3 pl-2">
        <span className="flex items-baseline gap-2 font-mono text-[0.62rem] tabular-nums tracking-[0.16em] uppercase text-muted-foreground">
          <span className={active ? 'text-brand-accent-foreground' : ''}>{String(index).padStart(2, '0')}</span>
          <span aria-hidden className="text-muted-foreground">·</span>
          <span>{concept.difficulty}</span>
        </span>
        <ConfidencePill confidence={concept.confidence} muted={!active} />
      </div>
      <p
        className={cn(
          'line-clamp-2 pl-2 text-sm font-medium leading-snug tracking-tight',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {concept.name}
      </p>
    </button>
  );
}

function ConceptListEmpty({ hasConcepts }: { hasConcepts: boolean }) {
  return (
    <div className="m-4 rounded-[1.25rem] border border-dashed border-border bg-white/[0.015] px-4 py-6">
      <p className="font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
        {hasConcepts ? 'No matches' : 'Empty'}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {hasConcepts
          ? 'Adjust the search query or difficulty filter to surface concepts again.'
          : 'No concepts yet. Use the chat to extract concepts from the current source.'}
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Pane: Graph canvas (middle)
// ───────────────────────────────────────────────────────────────────────────

function GraphCanvasPane({
  artifact,
  concepts,
  conceptNameById,
  isRunning,
  onSelectConcept,
  proposalCount,
  relationships,
  selectedConcept,
}: {
  artifact: ConceptGraphArtifact;
  concepts: ConceptRow[];
  conceptNameById: Map<string, string>;
  isRunning: boolean;
  onSelectConcept: (id: string, multi?: boolean) => void;
  proposalCount: number;
  relationships: RelationshipRow[];
  selectedConcept: ConceptRow | null;
}) {
  const hasGraph = concepts.length > 0 && relationships.length > 0;
  const hasConcepts = concepts.length > 0;

  return (
    <section
      aria-label="Concept graph canvas"
      className="flex min-h-[520px] flex-col border-b border-border bg-background lg:min-h-0 lg:border-b-0 lg:border-r"
    >
      <PaneHeader
        eyebrow="Concept graph"
        meta={
          artifact ? (
            <span className={artifactStatusVariant(artifact.status)}>
              {artifact.status.replace('_', ' ')}
            </span>
          ) : null
        }
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
            <GraphCanvas
              concepts={concepts}
              onSelectConcept={onSelectConcept}
              relationships={relationships}
              selectedConceptId={selectedConcept?.id ?? null}
            />
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
        artifact={artifact}
        concept={selectedConcept}
        concepts={concepts}
        conceptNameById={conceptNameById}
        relationships={relationships}
      />
    </section>
  );
}

function GraphCanvas({
  concepts,
  onSelectConcept,
  relationships,
  selectedConceptId,
}: {
  concepts: ConceptRow[];
  onSelectConcept: (id: string, multi?: boolean) => void;
  relationships: RelationshipRow[];
  selectedConceptId: string | null;
}) {
  const { resolvedTheme } = useTheme();
  const baseGraph = useMemo(
    () => buildConceptGraph(concepts, relationships),
    [concepts, relationships],
  );

  // Inject selection flag into node.data so the dark node card can render the
  // active ring. Edges get a softened style; outgoing edges from the selected
  // concept are emphasised.
  const decorated = useMemo(() => {
    const nodes = baseGraph.nodes.map((node) => ({
      ...node,
      data: { ...node.data, selected: node.id === selectedConceptId },
    }));
    const edges = baseGraph.edges.map((edge) => {
      const isLinked = edge.source === selectedConceptId || edge.target === selectedConceptId;
      return {
        ...edge,
        animated: isLinked,
        markerEnd: {
          color: isLinked ? 'var(--brand-accent)' : 'var(--brand-accent)',
          type: MarkerType.ArrowClosed,
        },
        style: {
          stroke: isLinked ? 'var(--brand-accent)' : 'rgba(83, 209, 203, 0.55)',
          strokeWidth: isLinked ? 2 : 1.4,
        },
      };
    });
    return { edges, nodes };
  }, [baseGraph, selectedConceptId]);

  return (
    <ReactFlow
      colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
      edges={decorated.edges}
      fitView
      fitViewOptions={{ padding: 0.22 }}
      maxZoom={1.4}
      minZoom={0.4}
      nodes={decorated.nodes}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      onNodeClick={(event, node) => onSelectConcept(node.id, event.ctrlKey || event.metaKey || event.shiftKey)}
      panOnDrag
      proOptions={{ hideAttribution: true }}
      zoomOnDoubleClick={false}
    >
      <Background gap={22} size={1} />
      <FlowToolbar />
    </ReactFlow>
  );
}

const nodeTypes = {
  concept: ConceptNode,
};

function ConceptNode({ data }: NodeProps<Node<ConceptNodeData, 'concept'>>) {
  return (
    <div
      className={cn(
        'w-56 rounded-2xl border bg-card px-4 py-3 transition-all duration-200 ease-out',
        data.selected
          ? 'border-brand-accent ring-1 ring-brand-accent/50 shadow-lg shadow-brand-accent/20'
          : 'border-border shadow-sm hover:border-brand-accent/50',
      )}
    >
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
        <span className="font-mono text-[0.65rem] tabular-nums text-muted-foreground">
          {formatConfidence(data.confidence)}
        </span>
      </div>
      <Handle
        className="!h-2.5 !w-2.5 !border-background !bg-brand-accent"
        position={Position.Right}
        type="source"
      />
    </div>
  );
}

function FlowToolbar() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  return (
    <Panel position="top-right">
      <div className="mr-3 mt-3 flex items-center gap-1 rounded-full border border-border bg-card/50 p-1 shadow-md backdrop-blur">
        <ToolbarButton label="Zoom out" onClick={() => zoomOut()}>
          <Minus className="size-3.5" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton label="Zoom in" onClick={() => zoomIn()}>
          <Plus className="size-3.5" strokeWidth={1.5} />
        </ToolbarButton>
        <ToolbarButton label="Fit view" onClick={() => fitView({ padding: 0.22 })}>
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
  children: React.ReactNode;
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

// ───────────────────────────────────────────────────────────────────────────
// Concept detail strip (bottom of middle pane)
// ───────────────────────────────────────────────────────────────────────────

function ConceptDetailStrip({
  artifact,
  concept,
  concepts,
  conceptNameById,
  relationships,
}: {
  artifact: ConceptGraphArtifact;
  concept: ConceptRow | null;
  concepts: ConceptRow[];
  conceptNameById: Map<string, string>;
  relationships: RelationshipRow[];
}) {
  if (!concept) {
    return (
      <footer className="border-t border-border px-5 py-4 text-xs leading-relaxed text-muted-foreground">
        Select a concept to inspect its definition, evidence, and relationship links.
      </footer>
    );
  }

  const incoming = relationships.filter((rel) => rel.targetConceptId === concept.id);
  const outgoing = relationships.filter((rel) => rel.sourceConceptId === concept.id);
  const evidence = getEvidence(concept.sourceEvidence);
  const nonDefinitionEvidence = evidence
    .filter((item) => !isSameConceptText(item.excerpt, concept.definition))
    .slice(0, 3);
  const displayEvidence = nonDefinitionEvidence.length
    ? nonDefinitionEvidence
    : evidence.slice(0, 3);
  const canPatchKnowledgebase =
    artifact?.status === 'generated' || artifact?.status === 'needs_revision';

  return (
    <footer className="border-t border-border bg-card px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-brand-accent-foreground">
              Selected
            </span>
            <DifficultyChip difficulty={concept.difficulty} />
            <ConfidencePill confidence={concept.confidence} />
          </div>
          <h3 className="text-base font-medium leading-snug tracking-tight text-foreground">
            {concept.name}
          </h3>
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{concept.definition}</p>
        </div>

        <EvidenceStack evidence={displayEvidence} totalCount={evidence.length} />
      </div>

      {incoming.length || outgoing.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {incoming.length ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono tabular-nums tracking-[0.16em] uppercase text-muted-foreground">
                Incoming
              </span>
              {incoming.map((rel) => (
                <RelationChip
                  key={rel.id}
                  label={conceptNameById.get(rel.sourceConceptId) ?? 'Unknown'}
                />
              ))}
            </span>
          ) : null}
          {outgoing.length ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono tabular-nums tracking-[0.16em] uppercase text-muted-foreground">
                Outgoing
              </span>
              {outgoing.map((rel) => (
                <RelationChip
                  key={rel.id}
                  label={conceptNameById.get(rel.targetConceptId) ?? 'Unknown'}
                />
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
      {artifact && (incoming.length || outgoing.length) ? (
        <KnowledgebaseRelationshipPatchList
          artifactId={artifact.id}
          concepts={concepts}
          disabled={!canPatchKnowledgebase}
          relationships={[...incoming, ...outgoing]}
        />
      ) : null}
      {artifact && evidence.length ? (
        <KnowledgebaseEvidencePatchList
          artifactId={artifact.id}
          concept={concept}
          disabled={!canPatchKnowledgebase}
          evidence={evidence}
        />
      ) : null}
      {artifact ? (
        <KnowledgebaseConceptPatchForm
          artifactId={artifact.id}
          concept={concept}
          disabled={!canPatchKnowledgebase}
        />
      ) : null}
    </footer>
  );
}

function KnowledgebaseEvidencePatchList({
  artifactId,
  concept,
  disabled,
  evidence,
}: {
  artifactId: string;
  concept: ConceptRow;
  disabled: boolean;
  evidence: SourceEvidence[];
}) {
  return (
    <details className="group mt-4 rounded-[1rem] border border-border bg-white/[0.02] open:bg-card/50">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <span className="font-mono tabular-nums tracking-[0.16em] uppercase text-brand-accent-foreground">
          Evidence patch
        </span>
        <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground group-open:text-brand-accent-foreground">
          {disabled ? 'locked' : `${evidence.length} refs`}
        </span>
      </summary>
      <div className="grid gap-3 border-t border-border p-4">
        {evidence.map((item, index) => (
          <KnowledgebaseEvidencePatchForm
            artifactId={artifactId}
            concept={concept}
            disabled={disabled}
            evidence={item}
            key={`${item.sourceId ?? "source"}-${item.blockId ?? index}`}
          />
        ))}
      </div>
    </details>
  );
}

function KnowledgebaseEvidencePatchForm({
  artifactId,
  concept,
  disabled,
  evidence,
}: {
  artifactId: string;
  concept: ConceptRow;
  disabled: boolean;
  evidence: SourceEvidence;
}) {
  const [state, formAction, isPending] = useActionState(updateKnowledgebaseEvidenceFormAction, {
    error: null,
    success: false,
  });

  return (
    <form action={formAction} className="grid gap-3 rounded-[0.9rem] border border-border bg-background/70 p-3 md:grid-cols-[11rem_minmax(0,1fr)_7rem]">
      <input name="artifactId" type="hidden" value={artifactId} />
      <input name="conceptId" type="hidden" value={concept.id} />
      <input name="originalBlockId" type="hidden" value={evidence.blockId ?? ''} />
      <input name="originalQuote" type="hidden" value={evidence.excerpt} />
      <input name="originalSourceId" type="hidden" value={evidence.sourceId ?? ''} />
      <label className="space-y-1.5">
        <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground">
          Source block
        </span>
        <input aria-label="Input field"  className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground outline-none transition-colors focus:border-brand-accent-border/60 disabled:opacity-50"
          defaultValue={evidence.blockId ?? ''}
          disabled={disabled || isPending}
          name="blockId"
          required
        />
      </label>
      <label className="space-y-1.5">
        <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground">
          Quote
        </span>
        <textarea aria-label="Text field" 
          className="min-h-10 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors focus:border-brand-accent-border/60 disabled:opacity-50"
          defaultValue={evidence.excerpt}
          disabled={disabled || isPending}
          name="quote"
          required
          rows={2}
        />
      </label>
      <div className="grid gap-2">
        <label className="space-y-1.5">
          <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground">
            Location
          </span>
          <input aria-label="Input field"  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none transition-colors focus:border-brand-accent-border/60 disabled:opacity-50"
            defaultValue={evidence.location ?? 'unknown'}
            disabled={disabled || isPending}
            name="locationLabel"
            required
          />
        </label>
        <input name="sourceId" type="hidden" value={evidence.sourceId ?? ''} />
        <Button disabled={disabled || isPending} size="sm" type="submit" variant="secondary">
          {isPending ? 'Saving' : 'Patch'}
        </Button>
      </div>
      {state.error ? (
        <p className="text-xs leading-5 text-status-danger-foreground md:col-span-3">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-xs leading-5 text-status-success-foreground md:col-span-3">
          Evidence version updated.
        </p>
      ) : null}
    </form>
  );
}

function KnowledgebaseRelationshipPatchList({
  artifactId,
  concepts,
  disabled,
  relationships,
}: {
  artifactId: string;
  concepts: ConceptRow[];
  disabled: boolean;
  relationships: RelationshipRow[];
}) {
  return (
    <details className="group mt-4 rounded-[1rem] border border-border bg-white/[0.02] open:bg-card/50">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <span className="font-mono tabular-nums tracking-[0.16em] uppercase text-brand-accent-foreground">
          Relationship patch
        </span>
        <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground group-open:text-brand-accent-foreground">
          {disabled ? 'locked' : `${relationships.length} editable`}
        </span>
      </summary>
      <div className="grid gap-3 border-t border-border p-4">
        {relationships.map((relationship) => (
          <KnowledgebaseRelationshipPatchForm
            artifactId={artifactId}
            concepts={concepts}
            disabled={disabled}
            key={relationship.id}
            relationship={relationship}
          />
        ))}
      </div>
    </details>
  );
}

function KnowledgebaseRelationshipPatchForm({
  artifactId,
  concepts,
  disabled,
  relationship,
}: {
  artifactId: string;
  concepts: ConceptRow[];
  disabled: boolean;
  relationship: RelationshipRow;
}) {
  const [state, formAction, isPending] = useActionState(updateKnowledgebaseRelationshipFormAction, {
    error: null,
    success: false,
  });
  const evidence = getEvidence(relationship.sourceEvidence);
  const evidenceQuality = getRelationshipEvidenceQuality(relationship.metadata);

  return (
    <div className="grid gap-3 rounded-[0.9rem] border border-border bg-background/70 p-3">
      <form action={formAction} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]">
        <input name="artifactId" type="hidden" value={artifactId} />
        <input name="relationshipId" type="hidden" value={relationship.id} />
        <input name="relationshipType" type="hidden" value={relationship.relationshipType} />
        <RelationshipConceptSelect
          concepts={concepts}
          defaultValue={relationship.sourceConceptId}
          disabled={disabled || isPending}
          label="Source"
          name="sourceConceptId"
        />
        <RelationshipConceptSelect
          concepts={concepts}
          defaultValue={relationship.targetConceptId}
          disabled={disabled || isPending}
          label="Target"
          name="targetConceptId"
        />
        <div className="grid content-end gap-2">
          <Button disabled={disabled || isPending} size="sm" type="submit" variant="secondary">
            {isPending ? 'Saving' : 'Patch'}
          </Button>
        </div>
        {state.error ? (
          <p className="text-xs leading-5 text-status-danger-foreground md:col-span-3">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-xs leading-5 text-status-success-foreground md:col-span-3">
            Relationship version updated.
          </p>
        ) : null}
      </form>
      {evidence.length ? (
        <div className="grid gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground">
              Relationship evidence
            </span>
            {evidenceQuality ? (
              <span className="rounded-full border border-brand-accent-border/20 bg-brand-accent-surface px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-[#9de7e2]">
                {evidenceQuality.evidenceStrength} · {Math.round(evidenceQuality.finalEvidenceScore * 100)}%
              </span>
            ) : null}
          </div>
          {evidence.map((item, index) => (
            <KnowledgebaseRelationshipEvidencePatchForm
              artifactId={artifactId}
              disabled={disabled}
              evidence={item}
              key={`${item.sourceId ?? "source"}-${item.blockId ?? index}`}
              relationship={relationship}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function KnowledgebaseRelationshipEvidencePatchForm({
  artifactId,
  disabled,
  evidence,
  relationship,
}: {
  artifactId: string;
  disabled: boolean;
  evidence: SourceEvidence;
  relationship: RelationshipRow;
}) {
  const [state, formAction, isPending] = useActionState(
    updateKnowledgebaseRelationshipEvidenceFormAction,
    {
      error: null,
      success: false,
    }
  );

  return (
    <form action={formAction} className="grid gap-2 rounded-[0.75rem] border border-border bg-white/[0.02] p-3 md:grid-cols-[10rem_minmax(0,1fr)_7rem]">
      <input name="artifactId" type="hidden" value={artifactId} />
      <input name="relationshipId" type="hidden" value={relationship.id} />
      <input name="originalBlockId" type="hidden" value={evidence.blockId ?? ''} />
      <input name="originalQuote" type="hidden" value={evidence.excerpt} />
      <input name="originalSourceId" type="hidden" value={evidence.sourceId ?? ''} />
      <input name="sourceId" type="hidden" value={evidence.sourceId ?? ''} />
      <label className="space-y-1.5">
        <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground">
          Block
        </span>
        <input aria-label="Input field"  className="h-9 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground outline-none transition-colors focus:border-brand-accent-border/60 disabled:opacity-50"
          defaultValue={evidence.blockId ?? ''}
          disabled={disabled || isPending}
          name="blockId"
          required
        />
      </label>
      <label className="space-y-1.5">
        <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground">
          Quote
        </span>
        <textarea aria-label="Text field" 
          className="min-h-9 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs leading-5 text-foreground outline-none transition-colors focus:border-brand-accent-border/60 disabled:opacity-50"
          defaultValue={evidence.excerpt}
          disabled={disabled || isPending}
          name="quote"
          required
          rows={2}
        />
      </label>
      <div className="grid gap-2">
        <input name="locationLabel" type="hidden" value={evidence.location ?? 'unknown'} />
        <Button disabled={disabled || isPending} size="sm" type="submit" variant="secondary">
          {isPending ? 'Saving' : 'Patch'}
        </Button>
      </div>
      {state.error ? (
        <p className="text-xs leading-5 text-status-danger-foreground md:col-span-3">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-xs leading-5 text-status-success-foreground md:col-span-3">
          Relationship evidence updated.
        </p>
      ) : null}
    </form>
  );
}

function RelationshipConceptSelect({
  concepts,
  defaultValue,
  disabled,
  label,
  name,
}: {
  concepts: ConceptRow[];
  defaultValue: string;
  disabled: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground">
        {label}
      </span>
      <select className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-brand-accent-border/60 disabled:opacity-50"
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
      >
        {concepts.map((concept) => (
          <option key={concept.id} value={concept.id}>
            {concept.name}
          </option>
        ))}
      </select>
    </label>
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
      <div className="max-w-md rounded-[1rem] border border-dashed border-border bg-white/[0.02] px-4 py-3 text-xs leading-5 text-muted-foreground">
        No grounded evidence quote is attached to this concept yet.
      </div>
    );
  }

  return (
    <div className="grid max-w-xl gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.6rem] tabular-nums tracking-[0.18em] uppercase text-brand-accent-foreground">
          Evidence
        </span>
        <span className="font-mono text-[0.58rem] tabular-nums tracking-[0.16em] uppercase text-muted-foreground">
          {evidence.length}/{totalCount} shown
        </span>
      </div>
      <div className="grid gap-2">
        {evidence.map((item, index) => (
          <blockquote
            className="relative rounded-[1rem] border border-border border-b-4 border-b-brand-accent/70 bg-card/50 px-4 py-3 text-xs leading-6 text-muted-foreground shadow-sm"
            key={`${item.sourceId ?? "source"}-${item.blockId ?? index}`}
          >
            <Quote className="absolute -top-2.5 -left-1 size-4 -rotate-12 text-brand-accent-foreground/72" strokeWidth={1.5} />
            <p className="line-clamp-2">{item.excerpt}</p>
            <cite className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.58rem] tabular-nums tracking-[0.14em] uppercase text-muted-foreground not-italic">
              {item.location ? <span>§{item.location}</span> : null}
              {item.blockId ? <span>{shortenBlockId(item.blockId)}</span> : null}
            </cite>
          </blockquote>
        ))}
      </div>
    </div>
  );
}

function KnowledgebaseConceptPatchForm({
  artifactId,
  concept,
  disabled,
}: {
  artifactId: string;
  concept: ConceptRow;
  disabled: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateKnowledgebaseConceptFormAction, {
    error: null,
    success: false,
  });

  return (
    <details className="group mt-4 rounded-[1rem] border border-border bg-card/50 open:bg-card/50">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <span className="font-mono tabular-nums tracking-[0.16em] uppercase text-brand-accent-foreground">
          Knowledgebase patch
        </span>
        <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground group-open:text-brand-accent-foreground">
          {disabled ? 'locked' : 'edit record'}
        </span>
      </summary>
      <form action={formAction} className="grid gap-3 border-t border-border p-4 md:grid-cols-[14rem_minmax(0,1fr)_9rem]">
        <input name="artifactId" type="hidden" value={artifactId} />
        <input name="conceptId" type="hidden" value={concept.id} />
        <label className="space-y-1.5">
          <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground">
            Name
          </span>
          <input aria-label="Input field"  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-brand-accent-border/60 disabled:opacity-50"
            defaultValue={concept.name}
            disabled={disabled || isPending}
            name="name"
            required
          />
        </label>
        <label className="space-y-1.5">
          <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground">
            Definition
          </span>
          <textarea aria-label="Text field" 
            className="min-h-10 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors focus:border-brand-accent-border/60 disabled:opacity-50"
            defaultValue={concept.definition}
            disabled={disabled || isPending}
            name="definition"
            required
            rows={2}
          />
        </label>
        <div className="grid gap-2">
          <label className="space-y-1.5">
            <span className="font-mono text-[0.6rem] tracking-[0.16em] uppercase text-muted-foreground">
              Difficulty
            </span>
            <select className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-brand-accent-border/60 disabled:opacity-50"
              defaultValue={concept.difficulty}
              disabled={disabled || isPending}
              name="difficulty"
            >
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
          </label>
          <Button disabled={disabled || isPending} size="sm" type="submit" variant="secondary">
            {isPending ? 'Saving' : 'Patch'}
          </Button>
        </div>
        {state.error ? (
          <p className="md:col-span-3 text-xs leading-5 text-status-danger-foreground">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="md:col-span-3 text-xs leading-5 text-status-success-foreground">
            Knowledgebase version updated.
          </p>
        ) : null}
      </form>
    </details>
  );
}

function RelationChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2 py-0.5 text-[0.7rem] text-muted-foreground">
      <ArrowRight className="size-3 text-brand-accent-foreground" strokeWidth={1.5} />
      {label}
    </span>
  );
}

function isSameConceptText(left: string, right: string): boolean {
  return normalizeConceptText(left) === normalizeConceptText(right);
}

function normalizeConceptText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?]+$/g, '');
}

// ───────────────────────────────────────────────────────────────────────────
// Pane: Refinement chat (right)
// ───────────────────────────────────────────────────────────────────────────

function ChatPane({
  collapsed,
  items,
  onCollapseToggle,
  projectId,
  chatContextConcepts,
  onRemoveChatContext,
}: {
  collapsed: boolean;
  items: ChatItem[];
  onCollapseToggle: () => void;
  projectId: string;
  chatContextConcepts: ConceptRow[];
  onRemoveChatContext: (id: string) => void;
  sourceReady: boolean;
  sourceWords: number;
}) {
  const { refresh } = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput('');
    setIsLoading(true);

    const userMsgId = `user-${Date.now()}`;
    const agentMsgId = `agent-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userMsgId, kind: 'message', role: 'user', text: userText, streaming: false },
      { id: agentMsgId, kind: 'message', role: 'agent', text: '', streaming: true },
    ]);

    try {
      const payloadMessages = [
        ...messages.reduce((acc, m) => {
          if (m.kind === 'message') acc.push({ role: m.role === 'agent' ? 'assistant' : m.role, content: m.text });
          return acc;
        }, [] as any[]),
        { role: 'user', content: userText }
      ];

      const response = await fetch(`/api/v1/projects/${projectId}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: payloadMessages,
          selectedConcepts: chatContextConcepts.map((concept) => ({
            id: concept.id,
            name: concept.name,
          }))
        }),
      });

      if (!response.ok) {
        throw new Error('Agent request failed');
      }

      if (!response.body) throw new Error('No stream body returned');

      let displayText = '';
      let hasAgentMessage = true;

      await consumeUIMessageChunks(response.body, (chunk) => {
        if (chunk.type === 'data-agent-activity') {
          const event = chunk.data as StreamEvent;
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.kind === 'event' && lastMsg.event.type === 'agent_activity') {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = { ...lastMsg, event };
              return newMessages;
            }
            return [
              ...prev,
              { id: `activity-${Date.now()}-${prev.length}`, kind: 'event', event },
            ];
          });
          return;
        }

        if (chunk.type === 'text-start') {
          setMessages(prev => {
            if (hasAgentMessage) {
              return prev;
            }

            hasAgentMessage = true;
            return [
              ...prev,
              { id: agentMsgId, kind: 'message', role: 'agent', text: '', streaming: true },
            ];
          });
          return;
        }

        if (chunk.type === 'text-delta') {
          displayText += chunk.delta;
          setMessages(prev => {
            if (!hasAgentMessage) {
              hasAgentMessage = true;
              return [
                ...prev,
                { id: agentMsgId, kind: 'message', role: 'agent', text: displayText, streaming: true },
              ];
            }

            return prev.map((m: any) => 
              m.id === agentMsgId ? { ...m, text: displayText } : m
            );
          });
          return;
        }

        if (chunk.type === 'text-end' || chunk.type === 'finish') {
          const finalText = displayText.trim()
            ? displayText
            : 'Selesai. Agent tidak mengirim ringkasan teks, tapi event stream sudah selesai.';

          setMessages(prev => {
            const filtered = prev.filter((m: any) => !(m.kind === 'event' && m.event.type === 'agent_activity'));
            
            if (!hasAgentMessage) {
              hasAgentMessage = true;
              return [
                ...filtered,
                { id: agentMsgId, kind: 'message', role: 'agent', text: finalText, streaming: false },
              ];
            }

            return filtered.map(m =>
              m.id === agentMsgId ? { ...m, text: finalText, streaming: false } : m
            );
          });
        }
      });
    } catch (err) {
      console.error('Chat failed:', err);
      setMessages(prev => {
        const filtered = prev.filter((m: any) => !(m.kind === 'event' && m.event.type === 'agent_activity'));
        const fallbackText = 'Maaf, agent berhenti sebelum selesai. Coba ulangi dengan instruksi yang lebih spesifik.';
        if (!filtered.some((m) => m.id === agentMsgId)) {
          return [
            ...filtered,
            { id: agentMsgId, kind: 'message', role: 'agent', text: fallbackText, streaming: false },
          ];
        }

        return filtered.map(m => 
          m.id === agentMsgId ? { ...m, text: fallbackText } : m
        );
      });
    } finally {
      setIsLoading(false);
      setMessages(prev => prev.map((m: any) => 
        m.id === agentMsgId ? { ...m, streaming: false } : m
      ));
      refresh();
    }
  };

  // Pin the timeline to the latest activity.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    queueMicrotask(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [items, messages]);

  if (collapsed) {
    return (
      <CollapsedPaneRail
        ariaLabel="Expand refinement"
        eyebrow="Refinement"
        meta="active"
        onToggle={onCollapseToggle}
        side="right"
        title="Graph agent"
      />
    );
  }

  return (
    <aside aria-label="Refinement chat" className="flex min-h-[520px] w-full flex-col border-l border-border bg-card lg:min-h-0">
      <PaneHeader
        eyebrow="Refinement"
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent-border/30 bg-brand-accent-surface px-2 py-0.5 font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-brand-accent-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-brand-accent" />
            active
          </span>
        }
        onCollapseToggle={onCollapseToggle}
        side="right"
        title="Graph agent"
      />

      <div className="border-b border-border px-4 py-3">
        <p className="text-[0.78rem] leading-5 text-muted-foreground">
          Chat with the agent to modify concepts and relationships directly.
          Hold <kbd className="font-mono text-[0.65rem] border border-border bg-white/5 rounded px-1">Ctrl/Cmd</kbd> and click concepts to attach them as context.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4" ref={scrollRef}>
        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              {item.kind === 'message' ? (
                <ChatMessage role={item.role} streaming={false} text={item.text} />
              ) : (
                <ChatEvent event={item.event} />
              )}
            </li>
          ))}
          {messages.map((item) => (
            <li key={item.id}>
              {item.kind === 'message' ? (
                <ChatMessage role={item.role} streaming={item.streaming || false} text={item.text} />
              ) : (
                <ChatEvent event={item.event} />
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex flex-col gap-2">
        {chatContextConcepts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chatContextConcepts.map(concept => (
              <span key={concept.id} className="inline-flex items-center gap-1 rounded-full border border-brand-accent-border/30 bg-brand-accent-surface pl-2 pr-1 py-0.5 text-xs text-brand-accent-foreground">
                {concept.name}
                <button aria-label="Button"  type="button"
                  onClick={() => onRemoveChatContext(concept.id)}
                  className="rounded-full p-0.5 hover:bg-brand-accent/20 text-brand-accent-foreground/70 hover:text-brand-accent-foreground transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input aria-label="Input field"  className="flex-1 rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:border-brand-accent-border focus:outline-none focus:ring-1 focus:ring-[#53d1cb]/50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Instruct the agent..."
            disabled={isLoading}
          />
          <button aria-label="Button"  type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-md bg-brand-accent/20 px-3 py-2 text-sm font-medium text-brand-accent-foreground hover:bg-brand-accent/30 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </aside>
  );
}

function ChatMessage({
  role,
  streaming,
  text,
}: {
  role: 'agent' | 'user';
  streaming: boolean;
  text: string;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[28ch] rounded-2xl rounded-br-md border border-brand-accent-border bg-brand-accent/[0.08] px-3.5 py-2 text-sm leading-6 text-foreground sm:max-w-[36ch]">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-card text-brand-accent-foreground"
      >
        <Bot className="size-3.5" strokeWidth={1.5} />
      </span>
      <div className="max-w-[34ch] rounded-2xl rounded-tl-md border border-border bg-card/50 px-3.5 py-2 text-sm leading-6 text-muted-foreground">
        <MarkdownText text={text} />
        {streaming ? (
          <span aria-hidden className="ml-1 inline-block h-3.5 w-[2px] translate-y-0.5 bg-brand-accent stream-cursor" />
        ) : null}
      </div>
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div className="space-y-2.5 break-words">
      {/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => (
            <p className="whitespace-pre-wrap text-muted-foreground" {...props} />
          ),
          a: ({ node, ...props }) => (
              <a
                className="text-[#9de7e2] underline decoration-[#53d1cb]/40 underline-offset-4 transition-colors hover:text-[#c8fffb]"
                target="_blank"
                rel="noreferrer"
                {...props}
              >{props.children || 'link'}</a>
            ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-foreground" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc space-y-1 pl-4 text-muted-foreground" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal space-y-1 pl-4 text-muted-foreground" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li {...props} />
          ),
          pre: ({ node, ...props }) => (
            <pre 
              className="overflow-x-auto rounded-lg border border-border bg-[#050b12] p-3 font-mono text-[0.72rem] leading-5 text-[#d9f7f4] [&>code]:bg-transparent [&>code]:border-0 [&>code]:p-0 [&>code]:text-inherit" 
              {...props} 
            />
          ),
          code: ({ node, ...props }: any) => (
            <code
              className="rounded border border-border bg-muted/50 px-1 py-0.5 font-mono text-[0.78em] text-[#9de7e2]"
              {...props}
            />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="mt-4 mb-2 text-lg font-semibold text-foreground" {...props}>{props.children}</h1>
          ),
          h2: ({ node, ...props }) => (
            <h2 className="mt-4 mb-2 text-base font-semibold text-foreground" {...props}>{props.children}</h2>
          ),
          h3: ({ node, ...props }) => (
            <h3 className="mt-3 mb-1.5 text-sm font-semibold text-foreground" {...props}>{props.children}</h3>
          ),
          table: ({ node, ...props }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm text-muted-foreground" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border-b border-border bg-card/50 px-3 py-2 font-medium text-foreground" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border-b border-border px-3 py-2 last:border-b-0" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-brand-accent-border pl-3 italic text-muted-foreground" {...props} />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function ChatEvent({ event }: { event: StreamEvent }) {
  const tone = getEventTone(event);
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border bg-white/[0.02] px-3 py-2 text-xs leading-5',
        tone.border,
      )}
    >
      <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-md', tone.iconBg)}>
        {tone.icon}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={cn('font-mono text-[0.6rem] tabular-nums tracking-[0.18em] uppercase', tone.label)}>
          {tone.title}
        </p>
        <p className="text-[0.78rem] leading-5 text-muted-foreground">{tone.copy}</p>
      </div>
    </div>
  );
}

function getEventTone(event: StreamEvent): {
  border: string;
  copy: string;
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  title: string;
} {
  switch (event.type) {
    case 'source_read':
      return {
        border: 'border-border',
        copy: event.title ? event.title : `Source · ${event.sourceId}`,
        icon: <FileText className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-card/50 text-muted-foreground',
        label: 'text-muted-foreground',
        title: 'Source read',
      };
    case 'concept_proposed':
      return {
        border: 'border-brand-accent-border',
        copy: event.definition ? `${event.name} — ${truncate(event.definition, 90)}` : event.name,
        icon: <Sparkles className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-brand-accent/[0.12] text-brand-accent',
        label: 'text-brand-accent-foreground',
        title: 'Concept proposed',
      };
    case 'relationship_proposed':
      return {
        border: 'border-brand-accent-border/18',
        copy: `${event.source} → ${event.target}`,
        icon: <GitBranch className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-brand-accent/[0.08] text-brand-accent',
        label: 'text-brand-accent-foreground',
        title: 'Prerequisite link',
      };
    case 'evidence_attached':
      return {
        border: 'border-border',
        copy: `${event.concept}${event.location ? ` · §${event.location}` : ''} — ${truncate(event.excerpt, 80)}`,
        icon: <Quote className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-card/50 text-muted-foreground',
        label: 'text-muted-foreground',
        title: 'Evidence attached',
      };
    case 'ingestion_complete':
      return {
        border: 'border-emerald-400/24',
        copy: `${event.conceptCount} concepts and ${event.relationshipCount} relationships ingested.`,
        icon: <CheckCircle2 className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-emerald-400/[0.14] text-emerald-300',
        label: 'text-emerald-300',
        title: 'Ingestion complete',
      };
    case 'agent_activity':
      return {
        border: event.status === 'started' ? 'border-brand-accent-border/18' : 'border-border',
        copy: event.detail,
        icon:
          event.status === 'started' ? (
            <CircleDashed className="size-3" strokeWidth={1.6} />
          ) : (
            <Info className="size-3" strokeWidth={1.6} />
          ),
        iconBg:
          event.status === 'started'
            ? 'bg-brand-accent/[0.08] text-brand-accent'
            : 'bg-card/50 text-muted-foreground',
        label: event.status === 'started' ? 'text-brand-accent-foreground' : 'text-muted-foreground',
        title: event.label,
      };
    default:
      return {
        border: 'border-border',
        copy: 'Activity',
        icon: <MessageSquareText className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-card/50 text-muted-foreground',
        label: 'text-muted-foreground',
        title: 'Event',
      };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Shared building blocks
// ───────────────────────────────────────────────────────────────────────────

function PaneHeader({
  eyebrow,
  meta,
  onCollapseToggle,
  side,
  title,
}: {
  eyebrow: string;
  meta?: React.ReactNode;
  onCollapseToggle?: () => void;
  side?: 'left' | 'right';
  title: string;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
      <div className="min-w-0 space-y-1">
        <span className="inline-flex items-center gap-2 font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
          {eyebrow}
        </span>
        <h2 className="truncate text-sm font-medium tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {meta ? <div>{meta}</div> : null}
        {onCollapseToggle && side ? (
          <button aria-label={side === 'left' ? 'Collapse concept inventory' : 'Collapse refinement'}
            aria-expanded="true"
            className="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-card/50 text-muted-foreground transition-colors hover:border-brand-accent-border hover:bg-brand-accent/8 hover:text-brand-accent-foreground"
            onClick={onCollapseToggle}
            type="button"
          >
            {side === 'left' ? (
              <ChevronsLeft className="size-3.5" strokeWidth={1.5} />
            ) : (
              <ChevronsRight className="size-3.5" strokeWidth={1.5} />
            )}
          </button>
        ) : null}
      </div>
    </header>
  );
}

function CollapsedPaneRail({
  ariaLabel,
  eyebrow,
  meta,
  onToggle,
  side,
  title,
}: {
  ariaLabel: string;
  eyebrow: string;
  meta: string;
  onToggle: () => void;
  side: 'left' | 'right';
  title: string;
}) {
  return (
    <aside
      aria-label={title}
      className={cn(
        'flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 lg:min-h-0 lg:flex-col lg:justify-start lg:border-b-0 lg:px-2 lg:py-3',
        side === 'left' ? 'lg:border-r' : 'lg:border-r-0',
      )}
    >
      <button aria-label={ariaLabel}
        aria-expanded="false"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card/50 text-muted-foreground transition-colors hover:border-brand-accent-border hover:bg-brand-accent/8 hover:text-brand-accent-foreground lg:size-10"
        onClick={onToggle}
        type="button"
      >
        {side === 'left' ? (
          <ChevronsRight className="size-4" strokeWidth={1.5} />
        ) : (
          <ChevronsLeft className="size-4" strokeWidth={1.5} />
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2 lg:min-h-0 lg:flex-none lg:flex-col">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand-accent pulse-soft" />
        <span className="truncate font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground lg:[writing-mode:vertical-rl]">
          {eyebrow}
        </span>
        <span className="truncate text-sm font-medium tracking-tight text-foreground lg:[writing-mode:vertical-rl]">
          {title}
        </span>
      </div>

      <span className="shrink-0 font-mono text-[0.62rem] tabular-nums tracking-[0.16em] uppercase text-muted-foreground lg:[writing-mode:vertical-rl]">
        {meta}
      </span>
    </aside>
  );
}

const difficultyChipVariants = cva(
  'inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[0.62rem] font-medium tracking-wide capitalize',
  {
    variants: {
      difficulty: {
        advanced: 'border-status-warning-border bg-status-warning-surface text-status-warning-foreground',
        beginner: 'border-status-success-border bg-status-success-surface text-status-success-foreground',
        intermediate: 'border-status-info-border bg-status-info-surface text-status-info-foreground',
      },
    },
  },
);

function DifficultyChip({ difficulty }: { difficulty: ConceptRow['difficulty'] }) {
  return <span className={difficultyChipVariants({ difficulty })}>{difficulty}</span>;
}

function ConfidencePill({ confidence, muted = false }: { confidence: string; muted?: boolean }) {
  const formatted = formatConfidence(confidence);
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-full border px-2 font-mono text-[0.62rem] tabular-nums',
        muted
          ? 'border-border bg-card/50 text-muted-foreground'
          : 'border-brand-accent-border/30 bg-brand-accent/[0.08] text-brand-accent',
      )}
      title="Confidence"
    >
      <CircleDashed className="size-3" strokeWidth={1.5} />
      {formatted}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

type SourceEvidence = {
  blockId?: string;
  excerpt: string;
  location?: string;
  sourceId?: string;
};

type RelationshipEvidenceQuality = {
  evidenceStrength: string;
  finalEvidenceScore: number;
};

function getEvidence(value: unknown): SourceEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SourceEvidence => {
    return (
      typeof item === 'object' &&
      item !== null &&
      'excerpt' in item &&
      typeof (item as { excerpt: unknown }).excerpt === 'string' &&
      (item as { excerpt: string }).excerpt.trim().length > 0
    );
  });
}

function getRelationshipEvidenceQuality(value: unknown): RelationshipEvidenceQuality | null {
  if (!value || typeof value !== 'object') return null;
  const metadata = value as { evidenceQuality?: unknown };
  const evidenceQuality = metadata.evidenceQuality;
  if (!evidenceQuality || typeof evidenceQuality !== 'object') return null;

  const record = evidenceQuality as Record<string, unknown>;
  if (
    typeof record.evidenceStrength !== 'string' ||
    typeof record.finalEvidenceScore !== 'number'
  ) {
    return null;
  }

  return {
    evidenceStrength: record.evidenceStrength,
    finalEvidenceScore: record.finalEvidenceScore,
  };
}

function shortenBlockId(blockId: string) {
  const parts = blockId.split(':');
  return parts.at(-1) ?? blockId;
}

function formatConfidence(value: string): string {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 'n/a';
  return `${Math.round(confidence * 100)}%`;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
