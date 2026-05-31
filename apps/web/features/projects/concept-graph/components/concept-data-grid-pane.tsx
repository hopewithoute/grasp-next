'use client';

import { useId, useRef, useEffect, useState, useCallback } from 'react';
import { type ConceptRow, type RelationshipRow, type DifficultyFilter } from '../types';
import { PaneHeader, DifficultyChip, ConfidencePill } from './shared-components';
import { BrainCircuit, ListFilter, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '../hooks/use-concept-graph-state';
import { searchKnowledgebaseConceptsAction } from '../../actions';

const DIFFICULTY_FILTER_ORDER: DifficultyFilter[] = ['all', 'beginner', 'intermediate', 'advanced'];

const DIFFICULTY_FILTER_LABEL: Record<DifficultyFilter, string> = {
  advanced: 'Advanced',
  all: 'All',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
};

export function ConceptDataGridPane({
  projectId,
  concepts,

  onSelectConcept,
  selectedConceptId,
}: {
  projectId: string;
  concepts: ConceptRow[];
  relationships: RelationshipRow[];
  onSelectConcept: (id: string) => void;
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
      className="flex flex-1 min-h-[520px] flex-col border-b border-border bg-background lg:min-h-0 lg:border-b-0 lg:border-r"
    >
      <PaneHeader eyebrow="Concept data grid" meta={`${filteredConcepts.length} Concepts`} title="Inventory Grid" />

      {/* Filter and Search Bar */}
      <div className="space-y-3 border-b border-border px-6 py-4">
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

        <address aria-label="Difficulty filter" className="flex flex-wrap gap-1.5 not-italic">
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

      <div className="flex-1 overflow-auto p-6 pt-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm text-left relative">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 font-medium">Concept</th>
                <th className="px-4 py-3 font-medium">Definition</th>
                <th className="px-4 py-3 font-medium w-24">Difficulty</th>
                <th className="px-4 py-3 font-medium w-24">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredConcepts.map((concept) => {
                const isSelected = selectedConceptId === concept.id;
                return (
                  <tr
                    key={concept.id}
                    onClick={() => onSelectConcept(concept.id)}
                    className={cn(
                      "group transition-colors cursor-pointer hover:bg-muted/30",
                      isSelected && "bg-brand-accent/5"
                    )}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-start gap-2">
                        <BrainCircuit className={cn("mt-0.5 size-4 shrink-0", isSelected ? "text-brand-accent" : "text-muted-foreground")} />
                        <span className={cn("font-medium", isSelected ? "text-foreground" : "text-foreground/80")}>
                          {concept.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-muted-foreground">
                      <p className="line-clamp-2 leading-relaxed">
                        {concept.definition}
                      </p>
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
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No concepts found in the current project matching your filters.
                  </td>
                </tr>
              )}
              {/* Intersection observer target for infinite scrolling */}
              <tr>
                <td colSpan={4} className="p-0">
                  <div ref={loadMoreRef} className="flex h-16 items-center justify-center">
                    {isLoadingMore ? (
                      <span className="font-mono text-xs text-muted-foreground">Loading…</span>
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
