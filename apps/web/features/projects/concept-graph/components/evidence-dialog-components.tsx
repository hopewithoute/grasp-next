'use client';

import { useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type ConceptRow, type RelationshipRow } from '../types';
import { shortenBlockId, type SourceEvidence } from '../concept-graph-utils';
import { DifficultyChip, ConfidencePill } from './shared-components';

// --- RelationChip ---

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemAnim = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 },
  },
};

function RelationChip({
  label,
  onClick,
  type,
}: {
  label: string;
  onClick?: () => void;
  type?: string;
}) {
  const formattedType = type ? type.replace('_', ' ') : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/30 py-1 pl-2.5 pr-3 text-[0.7rem] font-medium tracking-wide text-foreground/80 transition-colors hover:bg-muted/50 hover:border-brand-accent-border/50 cursor-pointer"
    >
      {formattedType ? (
        <span className="font-mono text-[0.55rem] tracking-[0.1em] uppercase text-muted-foreground/60">
          {formattedType}
        </span>
      ) : null}
      <span>{label}</span>
    </button>
  );
}

// --- RelationshipsStrip ---

export function RelationshipsStrip({
  concept,
  onSelectConcept,
  relationships,
  conceptNameById,
}: {
  concept: ConceptRow;
  onSelectConcept: (id: string) => void;
  relationships: RelationshipRow[];
  conceptNameById: Map<string, string>;
}) {
  const { incoming, outgoing } = useMemo(() => {
    const incoming: RelationshipRow[] = [];
    const outgoing: RelationshipRow[] = [];

    for (const relationship of relationships) {
      if (relationship.targetConceptId === concept.id) {
        incoming.push(relationship);
      }

      if (relationship.sourceConceptId === concept.id) {
        outgoing.push(relationship);
      }
    }

    incoming.sort((a, b) => {
      const nameA = conceptNameById.get(a.sourceConceptId) ?? 'Unknown';
      const nameB = conceptNameById.get(b.sourceConceptId) ?? 'Unknown';
      return nameA.localeCompare(nameB);
    });

    outgoing.sort((a, b) => {
      const nameA = conceptNameById.get(a.targetConceptId) ?? 'Unknown';
      const nameB = conceptNameById.get(b.targetConceptId) ?? 'Unknown';
      return nameA.localeCompare(nameB);
    });

    return { incoming, outgoing };
  }, [concept.id, conceptNameById, relationships]);

  if (!incoming.length && !outgoing.length) return null;

  return (
    <div className="pt-2 flex flex-col gap-2.5">
      {incoming.length > 0 && (
        <div className="flex items-start gap-3">
          <span className="w-8 shrink-0 pt-1.5 font-mono text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground/50 text-right">
            In
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {incoming.map((rel) => (
              <RelationChip
                key={rel.id}
                label={conceptNameById.get(rel.sourceConceptId) ?? 'Unknown'}
                type={rel.relationshipType}
                onClick={() => onSelectConcept(rel.sourceConceptId)}
              />
            ))}
          </div>
        </div>
      )}
      {outgoing.length > 0 && (
        <div className="flex items-start gap-3">
          <span className="w-8 shrink-0 pt-1.5 font-mono text-[0.6rem] tracking-[0.2em] uppercase text-muted-foreground/50 text-right">
            Out
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {outgoing.map((rel) => (
              <RelationChip
                key={rel.id}
                label={conceptNameById.get(rel.targetConceptId) ?? 'Unknown'}
                type={rel.relationshipType}
                onClick={() => onSelectConcept(rel.targetConceptId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- ConceptDetailStrip ---

export function ConceptDetailStrip({
  concept,
  conceptNameById,
  onSelectConcept,
  relationships,
  onViewEvidence,
}: {
  concept: ConceptRow | null;
  conceptNameById: Map<string, string>;
  onSelectConcept: (id: string) => void;
  relationships: RelationshipRow[];
  onViewEvidence: () => void;
}) {
  return (
    <div className="relative z-50 w-full border-t border-border/40 bg-card/80 backdrop-blur-xl">
      <AnimatePresence mode="wait">
        {!concept ? (
          <m.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center justify-center w-full px-6 py-4 text-xs font-medium tracking-wide text-muted-foreground"
          >
            Select a concept to inspect its details, evidence, and relationships
          </m.div>
        ) : (
          <m.div
            key="selected"
            layoutId="concept-strip"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 250, damping: 25 }}
            className="w-full p-5 md:p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"
          >
            {/* Left side info */}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <DifficultyChip difficulty={concept.difficulty} />
                <ConfidencePill confidence={concept.confidence} />
              </div>
              <h3 className="text-lg md:text-xl font-medium tracking-tight text-foreground">
                {concept.name}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2 max-w-3xl">
                {concept.definition}
              </p>

              {/* Relationships */}
              <RelationshipsStrip
                concept={concept}
                onSelectConcept={onSelectConcept}
                relationships={relationships}
                conceptNameById={conceptNameById}
              />
            </div>

            {/* Right side Actions */}
            <div className="flex shrink-0 w-full md:w-auto items-center justify-between gap-6 md:flex-col md:items-end border-t md:border-t-0 md:border-l border-border/40 pt-4 md:pt-0 md:pl-6">
              <div className="flex flex-col items-start md:items-end gap-0.5 md:text-right">
                <span className="text-2xl font-light tracking-tighter text-foreground">
                  {concept.evidenceCount ??
                    (Array.isArray(concept.sourceEvidence) ? concept.sourceEvidence.length : 0)}
                </span>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Citations
                </span>
              </div>

              <Button
                variant="default"
                className="rounded-full px-6 transition-all hover:scale-105 active:scale-95 shadow-sm border border-white/5"
                onClick={onViewEvidence}
              >
                <FileText className="mr-2 size-4 opacity-70" />
                Read Evidence
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- EvidenceSkeleton ---

export function EvidenceSkeleton() {
  return (
    <div className="flex flex-col w-full">
      <div className="h-3 w-24 bg-muted/50 rounded animate-pulse mb-8" />
      <div className="flex flex-col gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
            <div className="h-4 w-[85%] bg-muted/40 rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted/30 rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- EvidenceStack ---

export function EvidenceStack({
  evidence,
  totalCount,
}: {
  evidence: SourceEvidence[];
  totalCount: number;
}) {
  if (!evidence.length) {
    return (
      <div className="py-8 text-sm leading-relaxed text-muted-foreground/60 border-t border-border/50">
        No grounded evidence quote is attached to this concept yet.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3 mb-6">
        <span className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-foreground/40">
          Source Material
        </span>
        <span className="font-mono text-[0.65rem] tracking-[0.2em] uppercase text-brand-accent-foreground">
          {evidence.length} / {totalCount}
        </span>
      </div>

      <m.div variants={container} initial="hidden" animate="show" className="flex flex-col">
        {evidence.map((item, index) => (
          <m.blockquote
            variants={itemAnim}
            key={`${item.sourceId ?? 'source'}-${item.blockId ?? index}`}
            className="group relative overflow-hidden border-l-2 border-transparent hover:border-brand-accent/50 pl-5 py-5 -ml-5 transition-all duration-300"
          >
            <div className="absolute -left-2 top-2 font-serif text-[4rem] leading-none text-brand-accent-foreground/5 opacity-0 -translate-x-4 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:opacity-10 group-hover:translate-x-0 pointer-events-none select-none">
              &ldquo;
            </div>
            <p className="relative z-10 text-[0.92rem] leading-relaxed text-foreground/80 font-medium">
              &ldquo;{item.excerpt}&rdquo;
            </p>

            <cite className="mt-4 flex flex-wrap items-center gap-x-3 font-mono text-[0.65rem] tabular-nums tracking-[0.1em] uppercase text-muted-foreground not-italic">
              {item.location ? <span className="text-foreground/60">§ {item.location}</span> : null}
              {item.blockId ? (
                <span className="opacity-60">{shortenBlockId(item.blockId)}</span>
              ) : null}
            </cite>
          </m.blockquote>
        ))}
      </m.div>
    </div>
  );
}

// --- GraphCanvasSkeleton ---

export function GraphCanvasSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-16 w-44 animate-pulse rounded-2xl border border-border bg-muted/30"
            />
          ))}
        </div>
        <span className="mt-2 font-mono text-[0.62rem] tracking-[0.18em] uppercase text-muted-foreground">
          Loading graph…
        </span>
      </div>
    </div>
  );
}
