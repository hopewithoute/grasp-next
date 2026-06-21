'use client';

import { useId, useState } from 'react';
import { BrainCircuit, ListFilter, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    case 'beginner':
      return 'bg-status-success-foreground';
    case 'intermediate':
      return 'bg-status-info-foreground';
    case 'advanced':
      return 'bg-status-warning-foreground';
    default:
      return 'bg-brand-accent';
  }
}

export function ConceptDataGridPane({
  projectId: _projectId,
  concepts,
  relationships: _relationships,
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

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');

  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  const filteredConcepts = (concepts || []).filter((concept) => {
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      if (
        !concept.name.toLowerCase().includes(q) &&
        !concept.definition.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (difficultyFilter !== 'all' && concept.difficulty !== difficultyFilter) {
      return false;
    }
    return true;
  });

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
                <span aria-hidden className={cn('size-1.5', getFilterIconStyles(value))} />
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
              {filteredConcepts.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-8 text-center">
                    No concepts found in the current project matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
