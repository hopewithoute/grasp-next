'use client';

import { useMemo } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { shortenBlockId, type SourceEvidence } from '../concept-graph-utils';
import { type ConceptRow, type RelationshipRow } from '../types';
import { ConfidencePill, DifficultyChip } from './shared-components';

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
      className="border-border/50 bg-background/50 text-foreground hover:border-brand-accent/50 hover:bg-brand-accent/10 hover:text-brand-accent inline-flex cursor-pointer items-center gap-2 rounded-none border px-3 py-1 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-all"
    >
      {formattedType ? (
        <span className="text-muted-foreground/70 font-mono text-[0.55rem] tracking-[0.1em] uppercase">
          [{formattedType}]
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
    const sortByName =
      (getId: (rel: RelationshipRow) => string) => (a: RelationshipRow, b: RelationshipRow) =>
        (conceptNameById.get(getId(a)) ?? 'Unknown').localeCompare(
          conceptNameById.get(getId(b)) ?? 'Unknown'
        );

    return {
      incoming: relationships
        .filter((r) => r.targetConceptId === concept.id)
        .sort(sortByName((r) => r.sourceConceptId)),
      outgoing: relationships
        .filter((r) => r.sourceConceptId === concept.id)
        .sort(sortByName((r) => r.targetConceptId)),
    };
  }, [concept.id, conceptNameById, relationships]);

  if (!incoming.length && !outgoing.length) return null;

  const renderRelations = (
    title: string,
    list: RelationshipRow[],
    getId: (r: RelationshipRow) => string
  ) => {
    if (list.length === 0) return null;
    return (
      <div className="flex items-start gap-3">
        <span className="text-muted-foreground/50 w-8 shrink-0 pt-1.5 text-right font-mono text-[0.6rem] tracking-[0.2em] uppercase">
          {title}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {list.map((rel) => {
            const relatedId = getId(rel);
            return (
              <RelationChip
                key={rel.id}
                label={conceptNameById.get(relatedId) ?? 'Unknown'}
                type={rel.relationshipType}
                onClick={() => onSelectConcept(relatedId)}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2.5 pt-2">
      {renderRelations('In', incoming, (r) => r.sourceConceptId)}
      {renderRelations('Out', outgoing, (r) => r.targetConceptId)}
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
    <div className="border-border/40 bg-card/80 relative z-50 w-full border-t backdrop-blur-xl">
      <AnimatePresence mode="wait">
        {!concept ? (
          <m.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="text-muted-foreground flex w-full items-center justify-center px-6 py-4 text-xs font-medium tracking-wide"
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
            className="flex w-full flex-col items-start justify-between gap-6 p-5 md:flex-row md:items-center md:p-6"
          >
            {/* Left side info */}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <DifficultyChip difficulty={concept.difficulty} />
                <ConfidencePill confidence={concept.confidence} />
              </div>
              <h3 className="text-foreground font-mono text-lg tracking-widest uppercase md:text-xl">
                {concept.name}
              </h3>
              <p className="text-muted-foreground line-clamp-2 max-w-3xl text-sm leading-relaxed">
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
            <div className="border-border/40 flex w-full shrink-0 items-center justify-between gap-6 border-t pt-4 md:w-auto md:flex-col md:items-end md:border-t-0 md:border-l md:pt-0 md:pl-6">
              <div className="flex flex-col items-start gap-0.5 md:items-end md:text-right">
                <span className="text-foreground text-2xl font-light tracking-tighter">
                  {concept.evidenceCount ??
                    (Array.isArray(concept.sourceEvidence) ? concept.sourceEvidence.length : 0)}
                </span>
                <span className="text-muted-foreground/70 font-mono text-[0.6rem] tracking-[0.2em] uppercase">
                  [ CITATIONS ]
                </span>
              </div>

              <Button
                variant="default"
                className="border-brand-accent/50 bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-background rounded-none border px-6 font-mono text-[0.65rem] tracking-widest uppercase transition-all"
                onClick={onViewEvidence}
              >
                <FileText className="mr-2 size-3" />[ READ EVIDENCE ]
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
    <div className="flex w-full flex-col">
      <div className="bg-muted/50 mb-8 h-3 w-24 animate-pulse rounded" />
      <div className="flex flex-col gap-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="bg-muted/40 h-4 w-full animate-pulse rounded" />
            <div className="bg-muted/40 h-4 w-[85%] animate-pulse rounded" />
            <div className="bg-muted/30 mt-2 h-3 w-32 animate-pulse rounded" />
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
      <div className="text-muted-foreground/60 border-border/50 border-t py-8 text-sm leading-relaxed">
        No grounded evidence quote is attached to this concept yet.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between gap-3">
        <span className="text-foreground/40 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
          [ SOURCE_MATERIAL ]
        </span>
        <span className="text-brand-accent-foreground font-mono text-[0.65rem] tracking-[0.2em] uppercase">
          {evidence.length} / {totalCount}
        </span>
      </div>

      <m.div variants={container} initial="hidden" animate="show" className="flex flex-col">
        {evidence.map((item, index) => (
          <m.blockquote
            variants={itemAnim}
            key={`${item.sourceId ?? 'source'}-${item.blockId ?? index}`}
            className="group hover:border-brand-accent/50 relative -ml-5 overflow-hidden border-l-2 border-transparent py-5 pl-5 transition-all duration-300"
          >
            <div className="text-brand-accent-foreground/5 pointer-events-none absolute top-2 -left-2 -translate-x-4 font-serif text-[4rem] leading-none opacity-0 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] select-none group-hover:translate-x-0 group-hover:opacity-10">
              &ldquo;
            </div>
            <p className="text-foreground/80 relative z-10 text-[0.92rem] leading-relaxed font-medium">
              &ldquo;{item.excerpt}&rdquo;
            </p>

            <cite className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 font-mono text-[0.65rem] tracking-[0.1em] uppercase not-italic tabular-nums">
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
    <div className="bg-background flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="border-border/40 bg-muted/30 h-16 w-44 animate-pulse rounded-none border border-dashed"
            />
          ))}
        </div>
        <span className="text-muted-foreground mt-2 font-mono text-[0.62rem] tracking-[0.18em] uppercase">
          [ LOADING_GRAPH... ]
        </span>
      </div>
    </div>
  );
}

// --- ConceptEvidenceDialog ---

export function ConceptEvidenceDialog({
  concept,
  relationships,
  conceptNameById,
  isOpen,
  onClose,
  evidenceData,
  isLoadingEvidence,
  onSelectConcept,
}: {
  concept: ConceptRow | null;
  relationships: RelationshipRow[];
  conceptNameById: Map<string, string>;
  isOpen: boolean;
  onClose: () => void;
  evidenceData: SourceEvidence[];
  isLoadingEvidence: boolean;
  onSelectConcept: (id: string, multi?: boolean) => void;
}) {
  if (!concept) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="bg-background/95 border-border/50 max-h-[85vh] w-[95vw] max-w-2xl gap-0 overflow-hidden rounded-none border !p-0 shadow-2xl backdrop-blur-xl sm:max-w-4xl md:max-w-5xl lg:max-w-[1200px]">
        <div className="flex h-full max-h-[85vh] flex-col md:flex-row">
          {/* Left Side: Context / Asymmetric layout */}
          <div className="border-border/40 bg-muted/20 flex h-auto w-full flex-col border-b p-8 md:h-full md:w-1/3 md:overflow-y-auto md:border-r md:border-b-0 md:p-10">
            <DialogHeader className="space-y-4 text-left">
              <div className="space-y-2">
                <span className="text-muted-foreground/70 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                  [ CONCEPT ANALYSIS ]
                </span>
                <DialogTitle className="text-foreground font-mono text-2xl tracking-widest uppercase md:text-3xl">
                  {concept.name}
                </DialogTitle>
              </div>
              <DialogDescription className="text-foreground/60 mt-4 text-sm leading-relaxed">
                {concept.definition}
              </DialogDescription>
            </DialogHeader>

            <div className="border-border/40 mt-8 border-t pt-8">
              <span className="text-muted-foreground mb-4 block font-mono text-[0.65rem] tracking-[0.2em] uppercase">
                [ CONNECTIONS ]
              </span>
              <RelationshipsStrip
                concept={concept}
                onSelectConcept={onSelectConcept}
                relationships={relationships}
                conceptNameById={conceptNameById}
              />
            </div>

            <div className="mt-10 mt-auto flex flex-wrap gap-3 pt-8">
              <DifficultyChip difficulty={concept.difficulty} />
              <ConfidencePill confidence={concept.confidence} />
            </div>
          </div>

          {/* Right Side: Evidence List */}
          <div className="h-auto w-full p-8 md:h-full md:w-2/3 md:overflow-y-auto md:p-10">
            {isLoadingEvidence ? (
              <EvidenceSkeleton />
            ) : evidenceData.length > 0 ? (
              <EvidenceStack evidence={evidenceData} totalCount={evidenceData.length} />
            ) : (
              <div className="text-muted-foreground/60 border-border/50 border-t py-8 text-sm leading-relaxed">
                No source evidence attached.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
