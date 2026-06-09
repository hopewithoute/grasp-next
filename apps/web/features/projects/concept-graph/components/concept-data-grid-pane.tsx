'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { BrainCircuit, ListFilter, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchKnowledgebaseConceptsAction } from '../../actions';
import { useDebounce } from '../hooks/use-concept-graph-state';
import { type ConceptRow, type DifficultyFilter, type RelationshipRow } from '../types';
import { ConfidencePill, DifficultyChip, PaneHeader } from './shared-components';

const DIFFICULTY_FILTER_ORDER: DifficultyFilter[] = ['all', 'beginner', 'intermediate', 'advanced'];

const DIFFICULTY_FILTER_LABEL: Record<DifficultyFilter, string> = {
  advanced: 'Advanced',
  all: 'All',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
};

function getFilterButtonStyles(value: DifficultyFilter, isSelected: boolean) {
  if (isSelected) {
    switch (value) {
      case 'beginner':
        return 'border-status-success-border bg-status-success-surface text-status-success-foreground';
      case 'intermediate':
        return 'border-status-info-border bg-status-info-surface text-status-info-foreground';
      case 'advanced':
        return 'border-status-warning-border bg-status-warning-surface text-status-warning-foreground';
      default:
        return 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent';
    }
  }

  const base = 'border-border/40 bg-background/50 text-muted-foreground/70';
  switch (value) {
    case 'beginner':
      return cn(base, 'hover:border-status-success-border hover:text-status-success-foreground');
    case 'intermediate':
      return cn(base, 'hover:border-status-info-border hover:text-status-info-foreground');
    case 'advanced':
      return cn(base, 'hover:border-status-warning-border hover:text-status-warning-foreground');
    default:
      return cn(base, 'hover:border-brand-accent hover:text-brand-accent');
  }
}

function getFilterIconStyles(value: DifficultyFilter) {
  switch (value) {
    case 'beginner': return 'bg-status-success-foreground';
    case 'intermediate': return 'bg-status-info-foreground';
    case 'advanced': return 'bg-status-warning-foreground';
    default: return 'bg-brand-accent';
  }
}

export function ConceptDataGridPane({
  projectId,
  concepts,
  relationships,
  onSelectConcept,
  selectedConceptId,
  viewToggle,
}: {
  projectId: string;
  concepts: ConceptRow[];
  relationships: RelationshipRow[];
  onSelectConcept: (id: string) => void;
  selectedConceptId: string | null;
  viewToggle?: React.ReactNode;
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
          difficulty: difficulty === 'all' ? undefined : difficulty,
          offset,
          limit: 20, // using 20 for grid view instead of 5
        });

        setInventoryConcepts((prev: ConceptRow[]) => {
          const fetchedConcepts = result.concepts as ConceptRow[];
          if (replace) return fetchedConcepts;

          const existingIds = new Set(prev.map((c: ConceptRow) => c.id));
          const newConcepts = fetchedConcepts.filter((c: ConceptRow) => !existingIds.has(c.id));
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

  return (
    <section
      aria-label="Concept data grid"
      className="border-border bg-background flex min-h-[520px] flex-1 flex-col border-b lg:min-h-0 lg:border-r lg:border-b-0"
    >
      <PaneHeader
        meta={`${filteredConcepts.length} CONCEPTS`}
        actions={viewToggle}
        title="[ CONCEPT_DATA_GRID ]"
      />

      {/* Filter and Search Bar */}
      <div className="border-border space-y-3 border-b px-6 py-4">
        <label className="sr-only" htmlFor={searchInputId}>
          Search concepts
        </label>
        <div className="border-border/40 bg-background/50 focus-within:border-brand-accent flex h-9 items-center gap-2 rounded-none border px-3 transition-all">
          <Search className="text-muted-foreground/70 size-3.5 shrink-0" strokeWidth={1} />
          <input
            aria-label="Input field"
            className="text-foreground placeholder:text-muted-foreground/50 flex-1 border-0 bg-transparent font-mono text-[0.65rem] tracking-widest uppercase outline-none"
            id={searchInputId}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="[ SEARCH INVENTORY... ]"
            type="search"
            value={searchQuery}
          />
        </div>

        <address aria-label="Difficulty filter" className="flex flex-wrap gap-1.5 not-italic">
          {DIFFICULTY_FILTER_ORDER.map((value) => (
            <button
              aria-label="Button"
              aria-pressed={difficultyFilter === value}
              className={cn(
                'inline-flex h-7 items-center gap-2 rounded-none border px-2.5 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-all',
                getFilterButtonStyles(value, difficultyFilter === value)
              )}
              key={value}
              onClick={() => setDifficultyFilter(value)}
              type="button"
            >
              {value === 'all' ? (
                <ListFilter className="size-3" strokeWidth={1} />
              ) : (
                <span 
                  aria-hidden 
                  className={cn('size-1.5', getFilterIconStyles(value))} 
                />
              )}
              [ {DIFFICULTY_FILTER_LABEL[value].toUpperCase()} ]
            </button>
          ))}
        </address>
      </div>

      <div className="flex-1 overflow-auto p-6 pt-4">
        <div className="border-border/40 bg-background/50 overflow-hidden rounded-none border">
          <table className="relative w-full text-left font-mono text-xs">
            <thead className="bg-muted/10 text-muted-foreground/70 border-border/40 sticky top-0 z-10 border-b border-dashed tracking-widest uppercase">
              <tr>
                <th className="px-4 py-3 font-normal">CONCEPT</th>
                <th className="px-4 py-3 font-normal">DEFINITION</th>
                <th className="w-32 px-4 py-3 font-normal">DIFFICULTY</th>
                <th className="w-32 px-4 py-3 font-normal">CONFIDENCE</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {filteredConcepts.map((concept) => {
                const isSelected = selectedConceptId === concept.id;
                return (
                  <tr
                    key={concept.id}
                    onClick={() => onSelectConcept(concept.id)}
                    className={cn(
                      'group hover:bg-muted/30 cursor-pointer transition-colors',
                      isSelected && 'bg-brand-accent/5'
                    )}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-start gap-2">
                        <BrainCircuit
                          className={cn(
                            'mt-0.5 size-4 shrink-0',
                            isSelected ? 'text-brand-accent' : 'text-muted-foreground/50'
                          )}
                          strokeWidth={1}
                        />
                        <span
                          className={cn(
                            'font-mono tracking-widest uppercase',
                            isSelected ? 'text-brand-accent' : 'text-foreground/90'
                          )}
                        >
                          {concept.name}
                        </span>
                      </div>
                    </td>
                    <td className="text-muted-foreground/70 px-4 py-4 align-top">
                      <p className="line-clamp-2 leading-relaxed">{concept.definition}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <DifficultyChip difficulty={concept.difficulty} />
                    </td>
                    <td className="px-4 py-4 align-top">
                      <ConfidencePill confidence={concept.confidence} />
                    </td>
                  </tr>
                );
              })}
              {filteredConcepts.length === 0 && !isLoadingMore && (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                    No concepts found in the current project matching your filters.
                  </td>
                </tr>
              )}
              {/* Intersection observer target for infinite scrolling */}
              <tr>
                <td colSpan={4} className="p-0">
                  <div ref={loadMoreRef} className="flex h-16 items-center justify-center">
                    {isLoadingMore ? (
                      <span className="text-muted-foreground font-mono text-xs">Loading…</span>
                    ) : null}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
