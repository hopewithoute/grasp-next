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
  History,
  ListFilter,
  MessageSquareText,
  Minus,
  Network,
  Plus,
  Quote,
  Search,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { artifactStatusVariant } from './project-style-variants';
import {
  buildConceptGraph,
  type ConceptGraphArtifact,
  type ConceptRow,
  type RelationshipRow,
} from './concept-graph-view';

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

type ConceptGraphWorkspaceProps = {
  artifact: ConceptGraphArtifact;
  concepts: ConceptRow[];
  projectId: string;
  relationships: RelationshipRow[];
  sourceMaterial: string | null;
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
      relationshipType: 'prerequisite';
    }
  | { type: 'evidence_attached'; concept: string; excerpt: string; location?: string }
  | { type: 'graph_version_created'; artifactVersionId: string }
  | { type: 'review_ready'; artifactId: string };

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

function ConceptGraphEditor({
  artifact,
  concepts,
  projectId,
  relationships,
  sourceMaterial,
}: ConceptGraphWorkspaceProps) {
  const router = useRouter();
  const eventSourceRef = useRef<EventSource | null>(null);

  // Selection is stored as the user's *intent* and resolved during render against
  // the current concept list. This keeps state valid across server refreshes
  // (post-stream) without needing a setState-in-effect dance.
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(
    concepts[0]?.id ?? null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [instruction, setInstruction] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isInventoryCollapsed, setIsInventoryCollapsed] = useState(false);
  const [isRefinementCollapsed, setIsRefinementCollapsed] = useState(false);
  const [items, setItems] = useState<ChatItem[]>(() => [
    {
      id: 'agent-ready',
      kind: 'message',
      role: 'agent',
      text: artifact
        ? 'Concept graph is open. Tell me what to refine, or rebuild from the current source.'
        : 'I can build a concept graph from the current source and prepare a reviewable artifact.',
    },
  ]);

  const selectedConceptId = useMemo(() => {
    if (!concepts.length) return null;
    if (pendingSelectedId && concepts.some((concept) => concept.id === pendingSelectedId)) {
      return pendingSelectedId;
    }
    return concepts[0]?.id ?? null;
  }, [concepts, pendingSelectedId]);
  const setSelectedConceptId = setPendingSelectedId;

  // Tear down stream on unmount.
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  const filteredConcepts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return concepts.filter((concept) => {
      if (difficultyFilter !== 'all' && concept.difficulty !== difficultyFilter) {
        return false;
      }
      if (!query) return true;
      return (
        concept.name.toLowerCase().includes(query) ||
        concept.definition.toLowerCase().includes(query)
      );
    });
  }, [concepts, difficultyFilter, searchQuery]);

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

  const sourceReady = Boolean(sourceMaterial?.trim());
  const sourceWords = useMemo(() => {
    const trimmed = sourceMaterial?.trim() ?? '';
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [sourceMaterial]);

  const startRun = useCallback(
    (nextInstruction: string) => {
      eventSourceRef.current?.close();
      setIsRunning(true);

      const trimmed = nextInstruction.trim();
      if (trimmed) {
        setItems((current) => [
          ...current,
          {
            id: `user-${Date.now()}`,
            kind: 'message',
            role: 'user',
            text: trimmed,
          },
        ]);
      }

      const params = new URLSearchParams();
      if (trimmed) params.set('instruction', trimmed);

      const source = new EventSource(
        `/api/v1/projects/${projectId}/concept-graph/stream?${params.toString()}`,
      );
      eventSourceRef.current = source;

      source.addEventListener('graph_workspace', (message) => {
        const event = JSON.parse(message.data) as WorkspaceEvent;

        if (event.type === 'assistant_message') {
          setItems((current) => [
            ...current,
            {
              id: `agent-${Date.now()}-${current.length}`,
              kind: 'message',
              role: 'agent',
              text: event.text,
            },
          ]);
          return;
        }

        setItems((current) => [
          ...current,
          {
            id: `event-${Date.now()}-${current.length}`,
            kind: 'event',
            event,
          },
        ]);

        if (event.type === 'review_ready') {
          setIsRunning(false);
          source.close();
          eventSourceRef.current = null;
          router.refresh();
        }
      });

      source.onerror = () => {
        source.close();
        eventSourceRef.current = null;
        setIsRunning(false);
        router.refresh();
      };
    },
    [projectId, router],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!instruction.trim()) return;
    const next = instruction;
    setInstruction('');
    startRun(next);
  };

  const composerDisabled = isRunning || !sourceReady;

  return (
    <section
      aria-label="Concept graph editor"
      className={cn(
        'grid min-h-[720px] w-full grid-cols-1 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d1824]/60 shadow-[0_24px_80px_rgba(0,0,0,0.28)] lg:h-[min(calc(100dvh-320px),920px)] lg:min-h-0',
        !isInventoryCollapsed &&
          !isRefinementCollapsed &&
          'lg:grid-cols-[20rem_minmax(0,1fr)_22rem] xl:grid-cols-[22rem_minmax(0,1fr)_24rem]',
        isInventoryCollapsed &&
          !isRefinementCollapsed &&
          'lg:grid-cols-[4rem_minmax(0,1fr)_22rem] xl:grid-cols-[4rem_minmax(0,1fr)_24rem]',
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
        onCollapseToggle={() => setIsInventoryCollapsed((current) => !current)}
        onDifficultyFilterChange={setDifficultyFilter}
        onSearchQueryChange={setSearchQuery}
        onSelectConcept={setSelectedConceptId}
        relationshipsCount={relationships.length}
        searchQuery={searchQuery}
        selectedConceptId={selectedConceptId}
      />

      <GraphCanvasPane
        artifact={artifact}
        concepts={concepts}
        isRunning={isRunning}
        onSelectConcept={setSelectedConceptId}
        proposalCount={proposalCount}
        relationships={relationships}
        selectedConcept={selectedConcept}
        conceptNameById={conceptNameById}
      />

      <ChatPane
        collapsed={isRefinementCollapsed}
        composerDisabled={composerDisabled}
        instruction={instruction}
        isRunning={isRunning}
        items={items}
        onInstructionChange={setInstruction}
        onCollapseToggle={() => setIsRefinementCollapsed((current) => !current)}
        onStartRun={startRun}
        onSubmit={handleSubmit}
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
  onCollapseToggle,
  onDifficultyFilterChange,
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
  onCollapseToggle: () => void;
  onDifficultyFilterChange: (value: DifficultyFilter) => void;
  onSearchQueryChange: (value: string) => void;
  onSelectConcept: (id: string) => void;
  relationshipsCount: number;
  searchQuery: string;
  selectedConceptId: string | null;
}) {
  const searchInputId = useId();

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
      className="flex min-h-[520px] flex-col border-b border-white/8 bg-[#0a131c] lg:min-h-0 lg:border-b-0 lg:border-r"
    >
      <PaneHeader
        eyebrow="Concepts"
        meta={
          <span className="font-mono tabular-nums text-[#f3efe3]/52">
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
        <div className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 transition-colors focus-within:border-[#53d1cb]/50 focus-within:bg-white/[0.05]">
          <Search className="size-3.5 shrink-0 text-[#f3efe3]/52" strokeWidth={1.5} />
          <input
            className="flex-1 border-0 bg-transparent text-sm leading-5 text-[#f3efe3] outline-none placeholder:text-[#f3efe3]/36"
            id={searchInputId}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search concept or definition"
            type="search"
            value={searchQuery}
          />
        </div>

        <div role="group" aria-label="Difficulty filter" className="flex flex-wrap gap-1.5">
          {DIFFICULTY_FILTER_ORDER.map((value) => (
            <button
              aria-pressed={difficultyFilter === value}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.7rem] font-medium tracking-wide transition-colors',
                difficultyFilter === value
                  ? 'border-[#53d1cb]/40 bg-[#53d1cb]/10 text-[#f3efe3]'
                  : 'border-white/10 bg-white/[0.025] text-[#f3efe3]/62 hover:border-white/20 hover:text-[#f3efe3]',
              )}
              key={value}
              onClick={() => onDifficultyFilterChange(value)}
              type="button"
            >
              {value === 'all' ? (
                <ListFilter className="size-3" strokeWidth={1.5} />
              ) : (
                <span aria-hidden className="size-1.5 rounded-full bg-[#53d1cb]" />
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
          <ol className="divide-y divide-white/8 border-y border-white/8">
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
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-white/8 px-4 py-3 font-mono text-[0.62rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/52">
        <span>{String(concepts.length).padStart(2, '0')} concepts</span>
        <span aria-hidden className="text-[#f3efe3]/24">·</span>
        <span>{String(relationshipsCount).padStart(2, '0')} prerequisites</span>
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
        false: 'bg-transparent hover:bg-white/[0.03]',
        true: 'bg-[#53d1cb]/[0.06]',
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
  onSelect: (id: string) => void;
}) {
  return (
    <button
      aria-current={active ? 'true' : undefined}
      className={conceptListItemVariants({ active })}
      onClick={() => onSelect(concept.id)}
      type="button"
    >
      {active ? (
        <span
          aria-hidden
          className="absolute top-3 bottom-3 left-0 w-[2px] rounded-full bg-[#53d1cb]"
        />
      ) : null}
      <div className="flex items-center justify-between gap-3 pl-2">
        <span className="flex items-baseline gap-2 font-mono text-[0.62rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
          <span className={active ? 'text-[#53d1cb]' : ''}>{String(index).padStart(2, '0')}</span>
          <span aria-hidden className="text-[#f3efe3]/20">·</span>
          <span>{concept.difficulty}</span>
        </span>
        <ConfidencePill confidence={concept.confidence} muted={!active} />
      </div>
      <p
        className={cn(
          'line-clamp-2 pl-2 text-sm font-medium leading-snug tracking-tight',
          active ? 'text-[#f3efe3]' : 'text-[#f3efe3]/82',
        )}
      >
        {concept.name}
      </p>
    </button>
  );
}

function ConceptListEmpty({ hasConcepts }: { hasConcepts: boolean }) {
  return (
    <div className="m-4 rounded-[1.25rem] border border-dashed border-white/12 bg-white/[0.015] px-4 py-6">
      <p className="font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/52">
        {hasConcepts ? 'No matches' : 'Empty'}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#f3efe3]/72">
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
  onSelectConcept: (id: string) => void;
  proposalCount: number;
  relationships: RelationshipRow[];
  selectedConcept: ConceptRow | null;
}) {
  const hasGraph = concepts.length > 0 && relationships.length > 0;
  const hasConcepts = concepts.length > 0;

  return (
    <section
      aria-label="Concept graph canvas"
      className="flex min-h-[520px] flex-col border-b border-white/8 bg-[#07111b] lg:min-h-0 lg:border-b-0 lg:border-r"
    >
      <PaneHeader
        eyebrow="Concept graph"
        meta={
          artifact ? (
            <span className={artifactStatusVariant(artifact.status)}>
              {artifact.status.replace('_', ' ')}
            </span>
          ) : (
            <span className="font-mono tabular-nums text-[#f3efe3]/52">not generated</span>
          )
        }
        title={artifact ? 'Active version' : 'No version yet'}
      />

      {isRunning || proposalCount > 0 ? (
        <div className="hairline-shimmer mx-4 mb-3 flex items-center gap-3 rounded-full border border-[#53d1cb]/24 bg-[#53d1cb]/[0.06] px-3.5 py-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-[#53d1cb] pulse-soft" />
          <span className="font-mono text-[0.62rem] tabular-nums tracking-[0.16em] uppercase text-[#53d1cb]">
            {isRunning ? 'Streaming' : 'Buffered'}
          </span>
          <span className="text-xs text-[#f3efe3]/72">
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
        concept={selectedConcept}
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
  onSelectConcept: (id: string) => void;
  relationships: RelationshipRow[];
  selectedConceptId: string | null;
}) {
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
          color: isLinked ? '#7ceae3' : '#53d1cb',
          type: MarkerType.ArrowClosed,
        },
        style: {
          stroke: isLinked ? '#7ceae3' : 'rgba(83, 209, 203, 0.55)',
          strokeWidth: isLinked ? 2 : 1.4,
        },
      };
    });
    return { edges, nodes };
  }, [baseGraph, selectedConceptId]);

  return (
    <ReactFlow
      colorMode="dark"
      edges={decorated.edges}
      fitView
      fitViewOptions={{ padding: 0.22 }}
      maxZoom={1.4}
      minZoom={0.4}
      nodes={decorated.nodes}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      onNodeClick={(_, node) => onSelectConcept(node.id)}
      panOnDrag
      proOptions={{ hideAttribution: true }}
      zoomOnDoubleClick={false}
    >
      <Background color="rgba(243, 239, 227, 0.08)" gap={22} size={1} />
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
        'w-56 rounded-2xl border bg-[#0d1824] px-4 py-3 transition-all duration-200 ease-out',
        data.selected
          ? 'border-[#53d1cb] shadow-[0_0_0_1px_rgba(83,209,203,0.6),0_18px_50px_rgba(7,17,27,0.55)]'
          : 'border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_rgba(0,0,0,0.28)] hover:border-white/24',
      )}
    >
      <Handle
        className="!h-2.5 !w-2.5 !border-[#0d1824] !bg-[#53d1cb]"
        position={Position.Left}
        type="target"
      />
      <p className="line-clamp-2 text-[0.82rem] font-medium leading-5 tracking-tight text-[#f3efe3]">
        {data.label}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <DifficultyChip difficulty={data.difficulty} />
        <span className="font-mono text-[0.65rem] tabular-nums text-[#f3efe3]/72">
          {formatConfidence(data.confidence)}
        </span>
      </div>
      <Handle
        className="!h-2.5 !w-2.5 !border-[#0d1824] !bg-[#53d1cb]"
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
      <div className="mr-3 mt-3 flex items-center gap-1 rounded-full border border-white/10 bg-[#0a131c]/90 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.32)] backdrop-blur">
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
    <button
      aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded-full text-[#f3efe3]/72 transition-colors hover:bg-white/[0.06] hover:text-[#f3efe3]"
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
    <div className="h-full overflow-y-auto px-5 py-5">
      <div className="mb-4 flex items-center gap-2 font-mono text-[0.65rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/52">
        <Network className="size-3.5 text-[#53d1cb]" strokeWidth={1.5} />
        <span>List view · no prerequisites</span>
      </div>
      <p className="mb-5 max-w-[60ch] text-sm leading-relaxed text-[#f3efe3]/72">
        Concepts were extracted, but the agent has not proposed prerequisite links yet. Review them
        as a flat list, then ask the agent to draw relationships.
      </p>
      <ol className="divide-y divide-white/8 border-y border-white/8">
        {concepts.map((concept, index) => (
          <li key={concept.id}>
            <button
              aria-current={concept.id === selectedConceptId ? 'true' : undefined}
              className={cn(
                'flex w-full items-start gap-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]',
                concept.id === selectedConceptId && 'bg-[#53d1cb]/[0.06]',
              )}
              onClick={() => onSelectConcept(concept.id)}
              type="button"
            >
              <span className="w-8 shrink-0 font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-[#53d1cb]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium tracking-tight text-[#f3efe3]">{concept.name}</p>
                <p className="line-clamp-2 text-[0.82rem] leading-5 text-[#f3efe3]/62">
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
          className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl border border-[#53d1cb]/24 bg-[#53d1cb]/[0.08] text-[#53d1cb]"
        >
          <Network className="size-5" strokeWidth={1.5} />
        </span>
        <p className="mt-4 font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/52">
          No graph yet
        </p>
        <h3 className="mt-2 text-xl font-medium tracking-tight text-[#f3efe3]">
          Generate from the current source.
        </h3>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed text-[#f3efe3]/62">
          Use the chat on the right to run a fresh extraction. Concepts and prerequisite edges will
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
  concept,
  conceptNameById,
  relationships,
}: {
  concept: ConceptRow | null;
  conceptNameById: Map<string, string>;
  relationships: RelationshipRow[];
}) {
  if (!concept) {
    return (
      <footer className="border-t border-white/8 px-5 py-4 text-xs leading-relaxed text-[#f3efe3]/52">
        Select a concept to inspect its definition, evidence, and prerequisite links.
      </footer>
    );
  }

  const incoming = relationships.filter((rel) => rel.targetConceptId === concept.id);
  const outgoing = relationships.filter((rel) => rel.sourceConceptId === concept.id);
  const evidence = getEvidence(concept.sourceEvidence);
  const headline = evidence.find((item) => !isSameConceptText(item.excerpt, concept.definition));

  return (
    <footer className="border-t border-white/8 bg-[#0a131c] px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-[#53d1cb]">
              Selected
            </span>
            <DifficultyChip difficulty={concept.difficulty} />
            <ConfidencePill confidence={concept.confidence} />
          </div>
          <h3 className="text-base font-medium leading-snug tracking-tight text-[#f3efe3]">
            {concept.name}
          </h3>
          <p className="line-clamp-2 text-sm leading-6 text-[#f3efe3]/72">{concept.definition}</p>
        </div>

        {headline ? (
          <blockquote className="relative max-w-md rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-[#f3efe3]/72 shadow-[inset_3px_0_0_#53d1cb]">
            <Quote className="absolute -top-2.5 -left-1 size-4 -rotate-12 text-[#53d1cb]/72" strokeWidth={1.5} />
            <p className="line-clamp-3">{headline.excerpt}</p>
            {headline.location ? (
              <cite className="mt-2 block font-mono text-[0.6rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/42 not-italic">
                §{headline.location}
              </cite>
            ) : null}
          </blockquote>
        ) : null}
      </div>

      {incoming.length || outgoing.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          {incoming.length ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
                Requires
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
              <span className="font-mono tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
                Unlocks
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
    </footer>
  );
}

function RelationChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[0.7rem] text-[#f3efe3]/82">
      <ArrowRight className="size-3 text-[#53d1cb]" strokeWidth={1.5} />
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
  composerDisabled,
  instruction,
  isRunning,
  items,
  onCollapseToggle,
  onInstructionChange,
  onStartRun,
  onSubmit,
  sourceReady,
  sourceWords,
}: {
  collapsed: boolean;
  composerDisabled: boolean;
  instruction: string;
  isRunning: boolean;
  items: ChatItem[];
  onCollapseToggle: () => void;
  onInstructionChange: (value: string) => void;
  onStartRun: (instruction: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  sourceReady: boolean;
  sourceWords: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // Pin the timeline to the latest activity.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    queueMicrotask(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [items, isRunning]);

  useEffect(() => {
    const node = composerRef.current;
    if (!node) return;

    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
    node.style.overflowY = 'hidden';
  }, [instruction]);

  if (collapsed) {
    return (
      <CollapsedPaneRail
        ariaLabel="Expand refinement"
        eyebrow="Refinement"
        meta={isRunning ? 'streaming' : 'ready'}
        onToggle={onCollapseToggle}
        side="right"
        title="Graph agent"
      />
    );
  }

  return (
    <aside aria-label="Refinement chat" className="flex min-h-[520px] flex-col bg-[#0a131c] lg:min-h-0">
      <PaneHeader
        eyebrow="Refinement"
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase">
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-full',
                isRunning ? 'bg-[#53d1cb] pulse-soft' : 'bg-emerald-400',
              )}
            />
            <span className={isRunning ? 'text-[#53d1cb]' : 'text-emerald-300/82'}>
              {isRunning ? 'streaming' : 'ready'}
            </span>
          </span>
        }
        onCollapseToggle={onCollapseToggle}
        side="right"
        title="Graph agent"
      />

      <div className="border-b border-white/8 px-4 py-3">
        <div className="grid grid-cols-3 gap-1.5">
          <ActionPill
            disabled={composerDisabled}
            icon={<Sparkles className="size-3.5" strokeWidth={1.5} />}
            label="Generate"
            onClick={() => onStartRun('')}
            tone="primary"
          />
          <ActionPill
            disabled={composerDisabled}
            icon={<Zap className="size-3.5" strokeWidth={1.5} />}
            label="Refine"
            onClick={() => onStartRun('Refine the current concept graph based on the latest source material.')}
          />
          <ActionPill
            disabled={composerDisabled}
            icon={<CheckCircle2 className="size-3.5" strokeWidth={1.5} />}
            label="Approve"
            onClick={() => onStartRun('Prepare the current concept graph for final review and approval.')}
          />
        </div>
        <p className="mt-2.5 flex items-center gap-2 font-mono text-[0.6rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
          <FileText className="size-3" strokeWidth={1.5} />
          <span>Source · {sourceReady ? `${sourceWords} words` : 'empty'}</span>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" ref={scrollRef}>
        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              {item.kind === 'message' ? (
                <ChatMessage
                  role={item.role}
                  streaming={Boolean(item.streaming) && isRunning}
                  text={item.text}
                />
              ) : (
                <ChatEvent event={item.event} />
              )}
            </li>
          ))}
          {isRunning ? (
            <li>
              <ChatTypingIndicator />
            </li>
          ) : null}
        </ol>
      </div>

      <form className="shrink-0 border-t border-white/8 bg-[#0a131c] px-4 py-3" onSubmit={onSubmit}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <label className="sr-only" htmlFor="graph-chat-composer">
            Refinement instruction
          </label>
          <textarea
            className="min-h-11 w-full resize-none overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm leading-6 text-[#f3efe3] outline-none transition-[height,border-color,background-color] duration-150 ease-out placeholder:text-[#f3efe3]/36 focus:border-[#53d1cb]/50 focus:bg-white/[0.05] disabled:opacity-60"
            disabled={composerDisabled}
            id="graph-chat-composer"
            onChange={(event) => onInstructionChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={
              sourceReady
                ? 'Ask the agent to merge, split, or re-evidence concepts…'
                : 'Add source material to enable refinement.'
            }
            ref={composerRef}
            rows={1}
            value={instruction}
          />
          <Button
            aria-label="Send instruction"
            className="size-11 rounded-2xl bg-[#53d1cb] text-[#041018] hover:bg-[#7ceae3] disabled:opacity-50"
            disabled={composerDisabled || !instruction.trim()}
            size="icon"
            type="submit"
          >
            <Send className="size-4" strokeWidth={1.6} />
          </Button>
        </div>
        {!sourceReady ? (
          <p className="mt-2 text-[0.7rem] leading-5 text-[#f3efe3]/52">
            The agent reads from your source material. Add or paste markdown in the source stage to
            unlock the chat.
          </p>
        ) : null}
      </form>
    </aside>
  );
}

const actionPillVariants = cva(
  'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border text-xs font-medium tracking-wide transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50',
  {
    defaultVariants: { tone: 'ghost' },
    variants: {
      tone: {
        ghost:
          'border-white/10 bg-white/[0.03] text-[#f3efe3]/82 hover:border-white/20 hover:bg-white/[0.06] hover:text-[#f3efe3] active:translate-y-px',
        primary:
          'border-[#53d1cb]/50 bg-[#53d1cb]/[0.12] text-[#7ceae3] hover:border-[#53d1cb] hover:bg-[#53d1cb]/[0.18] hover:text-[#f3efe3] active:translate-y-px',
      },
    },
  },
);

function ActionPill({
  disabled,
  icon,
  label,
  onClick,
  tone = 'ghost',
}: {
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'ghost' | 'primary';
}) {
  return (
    <button
      className={actionPillVariants({ tone })}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
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
        <p className="max-w-[28ch] rounded-2xl rounded-br-md border border-[#53d1cb]/24 bg-[#53d1cb]/[0.08] px-3.5 py-2 text-sm leading-6 text-[#f3efe3] sm:max-w-[36ch]">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-[#0d1824] text-[#53d1cb]"
      >
        <Bot className="size-3.5" strokeWidth={1.5} />
      </span>
      <p className="max-w-[34ch] rounded-2xl rounded-tl-md border border-white/8 bg-white/[0.03] px-3.5 py-2 text-sm leading-6 text-[#f3efe3]/82">
        {text}
        {streaming ? (
          <span aria-hidden className="ml-1 inline-block h-3.5 w-[2px] translate-y-0.5 bg-[#53d1cb] stream-cursor" />
        ) : null}
      </p>
    </div>
  );
}

function ChatTypingIndicator() {
  return (
    <div className="flex items-center gap-2.5 px-1 text-[0.7rem] text-[#f3efe3]/52">
      <span aria-hidden className="grid size-7 place-items-center rounded-full border border-white/10 bg-[#0d1824] text-[#53d1cb]">
        <Bot className="size-3.5" strokeWidth={1.5} />
      </span>
      <span className="flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-[#53d1cb] pulse-soft" />
        <span className="size-1.5 rounded-full bg-[#53d1cb]/72 pulse-soft" style={{ animationDelay: '0.2s' }} />
        <span className="size-1.5 rounded-full bg-[#53d1cb]/42 pulse-soft" style={{ animationDelay: '0.4s' }} />
      </span>
      <span className="font-mono uppercase tracking-[0.18em]">Reading source</span>
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
        <p className="text-[0.78rem] leading-5 text-[#f3efe3]/82">{tone.copy}</p>
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
        border: 'border-white/8',
        copy: event.title ? event.title : `Source · ${event.sourceId}`,
        icon: <FileText className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-white/[0.05] text-[#f3efe3]/72',
        label: 'text-[#f3efe3]/52',
        title: 'Source read',
      };
    case 'concept_proposed':
      return {
        border: 'border-[#53d1cb]/24',
        copy: event.definition ? `${event.name} — ${truncate(event.definition, 90)}` : event.name,
        icon: <Sparkles className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-[#53d1cb]/[0.12] text-[#7ceae3]',
        label: 'text-[#53d1cb]',
        title: 'Concept proposed',
      };
    case 'relationship_proposed':
      return {
        border: 'border-[#53d1cb]/18',
        copy: `${event.source} → ${event.target}`,
        icon: <GitBranch className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-[#53d1cb]/[0.08] text-[#7ceae3]',
        label: 'text-[#53d1cb]',
        title: 'Prerequisite link',
      };
    case 'evidence_attached':
      return {
        border: 'border-white/8',
        copy: `${event.concept}${event.location ? ` · §${event.location}` : ''} — ${truncate(event.excerpt, 80)}`,
        icon: <Quote className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-white/[0.05] text-[#f3efe3]/82',
        label: 'text-[#f3efe3]/72',
        title: 'Evidence attached',
      };
    case 'graph_version_created':
      return {
        border: 'border-white/8',
        copy: `Version ${event.artifactVersionId.slice(0, 6)} saved`,
        icon: <History className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-white/[0.06] text-[#f3efe3]/82',
        label: 'text-[#f3efe3]/52',
        title: 'Version saved',
      };
    case 'review_ready':
      return {
        border: 'border-emerald-400/24',
        copy: 'Artifact is ready for review and approval.',
        icon: <CheckCircle2 className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-emerald-400/[0.14] text-emerald-300',
        label: 'text-emerald-300',
        title: 'Review ready',
      };
    default:
      return {
        border: 'border-white/8',
        copy: 'Activity',
        icon: <MessageSquareText className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-white/[0.04] text-[#f3efe3]/72',
        label: 'text-[#f3efe3]/52',
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
    <header className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3.5">
      <div className="min-w-0 space-y-1">
        <span className="inline-flex items-center gap-2 font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/52">
          <span aria-hidden className="size-1.5 rounded-full bg-[#53d1cb] pulse-soft" />
          {eyebrow}
        </span>
        <h2 className="truncate text-sm font-medium tracking-tight text-[#f3efe3]">{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {meta ? <div>{meta}</div> : null}
        {onCollapseToggle && side ? (
          <button
            aria-label={side === 'left' ? 'Collapse concept inventory' : 'Collapse refinement'}
            aria-expanded="true"
            className="inline-flex size-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#f3efe3]/72 transition-colors hover:border-[#53d1cb]/24 hover:bg-[#53d1cb]/8 hover:text-[#53d1cb]"
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
        'flex min-h-16 items-center justify-between gap-3 border-b border-white/8 bg-[#0a131c] px-4 py-3 lg:min-h-0 lg:flex-col lg:justify-start lg:border-b-0 lg:px-2 lg:py-3',
        side === 'left' ? 'lg:border-r' : 'lg:border-r-0',
      )}
    >
      <button
        aria-label={ariaLabel}
        aria-expanded="false"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#f3efe3]/72 transition-colors hover:border-[#53d1cb]/24 hover:bg-[#53d1cb]/8 hover:text-[#53d1cb] lg:size-10"
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
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#53d1cb] pulse-soft" />
        <span className="truncate font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-[#f3efe3]/52 lg:[writing-mode:vertical-rl]">
          {eyebrow}
        </span>
        <span className="truncate text-sm font-medium tracking-tight text-[#f3efe3] lg:[writing-mode:vertical-rl]">
          {title}
        </span>
      </div>

      <span className="shrink-0 font-mono text-[0.62rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/52 lg:[writing-mode:vertical-rl]">
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
          ? 'border-white/10 bg-white/[0.03] text-[#f3efe3]/62'
          : 'border-[#53d1cb]/30 bg-[#53d1cb]/[0.08] text-[#7ceae3]',
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
  excerpt: string;
  location?: string;
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

function formatConfidence(value: string): string {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 'n/a';
  return `${Math.round(confidence * 100)}%`;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
