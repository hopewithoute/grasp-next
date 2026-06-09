import { Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ConceptRow } from '../types';
import { ConfidencePill, DifficultyChip } from './shared-components';

export function GraphListFallback({
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
      <div className="text-muted-foreground mb-4 flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.18em] uppercase tabular-nums">
        <Network className="text-brand-accent-foreground size-3.5" strokeWidth={1.5} />
        <span>[ LIST_VIEW: NO_RELATIONSHIPS ]</span>
      </div>
      <p className="text-muted-foreground/70 mb-5 max-w-[60ch] font-mono text-xs leading-relaxed uppercase">
        [ CONCEPTS EXTRACTED. AGENT HAS NOT PROPOSED LINKS YET. REVIEW FLAT LIST AND INSTRUCT AGENT
        TO CONNECT. ]
      </p>
      <ol className="divide-border border-border divide-y border-y">
        {concepts.map((concept, index) => (
          <li key={concept.id}>
            <button
              aria-label="Button"
              aria-current={concept.id === selectedConceptId ? 'true' : undefined}
              className={cn(
                'hover:bg-card/50 flex w-full items-start gap-4 py-3.5 text-left transition-colors',
                concept.id === selectedConceptId && 'bg-brand-accent-surface'
              )}
              onClick={() => onSelectConcept(concept.id)}
              type="button"
            >
              <span className="text-brand-accent-foreground w-8 shrink-0 font-mono text-[0.65rem] tracking-[0.16em] uppercase tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <p className="text-foreground font-mono text-xs tracking-widest uppercase">
                  {concept.name}
                </p>
                <p className="text-muted-foreground/70 line-clamp-2 font-mono text-[0.65rem] leading-5 tracking-widest uppercase">
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

export function GraphCanvasEmpty() {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="max-w-md text-center">
        <span
          aria-hidden
          className="border-brand-accent/50 bg-brand-accent/10 text-brand-accent mx-auto inline-flex size-12 items-center justify-center rounded-none border"
        >
          <Network className="size-5" strokeWidth={1} />
        </span>
        <p className="text-muted-foreground/70 mt-4 font-mono text-[0.62rem] tracking-[0.18em] uppercase tabular-nums">
          [ NO GRAPH YET ]
        </p>
        <h3 className="text-foreground mt-2 font-mono text-lg tracking-widest uppercase">
          [ GENERATE_FROM_SOURCE ]
        </h3>
        <p className="text-muted-foreground/70 mx-auto mt-3 max-w-[44ch] font-mono text-xs leading-relaxed uppercase">
          Use the chat on the right to run a fresh extraction. Concepts and relationship edges will
          stream in as the agent reads the material.
        </p>
      </div>
    </div>
  );
}
