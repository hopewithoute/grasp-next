import { useId, useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { cva } from 'class-variance-authority';
import { ListFilter, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ConceptRow } from '../types';
import { type DifficultyFilter } from '../types';
import { CollapsedPaneRail, PaneHeader, ConfidencePill } from './shared-components';
import { useDebounce } from '../hooks/use-concept-graph-state';
import { searchKnowledgebaseConceptsAction } from '../../actions';

const DIFFICULTY_FILTER_ORDER: DifficultyFilter[] = ['all', 'beginner', 'intermediate', 'advanced'];

const DIFFICULTY_FILTER_LABEL: Record<DifficultyFilter, string> = {
  advanced: 'Advanced',
  all: 'All',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
};

export const ConceptListPane = memo(function ConceptListPane({
  projectId,
  collapsed,
  concepts,
  onCollapseToggle,
  onSelectConcept,
  relationshipsCount,
  selectedConceptId,
}: {
  projectId: string;
  collapsed: boolean;
  concepts: ConceptRow[];
  onCollapseToggle: () => void;
  onSelectConcept: (id: string, multi?: boolean) => void;
  relationshipsCount: number;
  selectedConceptId: string | null;
}) {
  const searchInputId = useId();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [inventoryConcepts, setInventoryConcepts] = useState<ConceptRow[]>(concepts || []);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  const fetchConcepts = useCallback(
    async (query: string, difficulty: string, offset: number, replace = false) => {
      await Promise.resolve();
      setIsLoadingMore(true);
      try {
        const result = await searchKnowledgebaseConceptsAction({
          projectId,
          query,
          difficulty: difficulty === 'all' ? undefined : (difficulty as ConceptRow['difficulty']),
          offset,
          limit: 5,
        });

        setInventoryConcepts((prev: ConceptRow[]) => {
          const concepts = result.concepts as ConceptRow[];
          if (replace) return concepts;

          const existingIds = new Set(prev.map((c: ConceptRow) => c.id));
          const newConcepts = concepts.filter((c: ConceptRow) => !existingIds.has(c.id));
          return [...prev, ...newConcepts];
        });
        const nextLength = replace ? result.concepts.length : offset + result.concepts.length;
        setHasMore(nextLength < result.totalCount);
      } catch (error) {
        console.error('Failed to fetch concepts', error);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchConcepts(debouncedSearchQuery, difficultyFilter, 0, true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [debouncedSearchQuery, difficultyFilter, fetchConcepts]);

  const loadMoreConcepts = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    fetchConcepts(debouncedSearchQuery, difficultyFilter, inventoryConcepts.length, false);
  }, [
    hasMore,
    isLoadingMore,
    fetchConcepts,
    debouncedSearchQuery,
    difficultyFilter,
    inventoryConcepts.length,
  ]);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreConcepts();
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
  }, [hasMore, isLoadingMore, loadMoreConcepts]);

  const filteredConcepts = inventoryConcepts;

  const conceptCountMeta = useMemo(
    () => (
      <span className="font-mono tabular-nums text-muted-foreground">
        {String(filteredConcepts.length).padStart(2, '0')} /{' '}
        {String(concepts.length).padStart(2, '0')}
      </span>
    ),
    [filteredConcepts.length, concepts.length]
  );

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
        meta={conceptCountMeta}
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
          <input
            aria-label="Input field"
            className="flex-1 border-0 bg-transparent text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
            id={searchInputId}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search concept or definition"
            type="search"
            value={searchQuery}
          />
        </div>

        <address aria-label="Difficulty filter" className="flex flex-wrap gap-1.5">
          {DIFFICULTY_FILTER_ORDER.map((value) => (
            <button
              aria-label="Button"
              aria-pressed={difficultyFilter === value}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.7rem] font-medium tracking-wide transition-colors',
                difficultyFilter === value
                  ? 'border-brand-accent-border bg-brand-accent-surface text-foreground'
                  : 'border-border bg-card/50 text-muted-foreground hover:border-border hover:text-foreground'
              )}
              key={value}
              onClick={() => setDifficultyFilter(value)}
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
        </address>
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
                <button
                  aria-label="Button"
                  type="button"
                  onClick={loadMoreConcepts}
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
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
        <span>{String(relationshipsCount).padStart(2, '0')} relationships</span>
      </footer>
    </aside>
  );
});

const conceptListItemVariants = cva(
  'group relative flex w-full flex-col gap-2 px-4 py-3 text-left transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:translate-x-1.5',
  {
    defaultVariants: { active: false },
    variants: {
      active: {
        false: 'bg-transparent hover:bg-card/50',
        true: 'bg-brand-accent-surface',
      },
    },
  }
);

const ConceptListItem = memo(function ConceptListItem({
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
    <button
      aria-label="Button"
      aria-current={active ? 'true' : undefined}
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
          <span className={active ? 'text-brand-accent-foreground' : ''}>
            {String(index).padStart(2, '0')}
          </span>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <span>{concept.difficulty}</span>
        </span>
        <ConfidencePill confidence={concept.confidence} muted={!active} />
      </div>
      <p
        className={cn(
          'line-clamp-2 pl-2 text-sm font-medium leading-snug tracking-tight',
          active ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {concept.name}
      </p>
    </button>
  );
});

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
