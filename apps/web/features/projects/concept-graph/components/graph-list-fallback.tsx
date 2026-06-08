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
        <span>List view · no relationships</span>
      </div>
      <p className="text-muted-foreground mb-5 max-w-[60ch] text-sm leading-relaxed">
        Concepts were extracted, but the agent has not proposed relationship links yet. Review them
        as a flat list, then ask the agent to connect them.
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
                <p className="text-foreground text-sm font-medium tracking-tight">{concept.name}</p>
                <p className="text-muted-foreground line-clamp-2 text-[0.82rem] leading-5">
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
          className="border-brand-accent-border bg-brand-accent/[0.08] text-brand-accent-foreground mx-auto inline-flex size-12 items-center justify-center rounded-2xl border"
        >
          <Network className="size-5" strokeWidth={1.5} />
        </span>
        <p className="text-muted-foreground mt-4 font-mono text-[0.62rem] tracking-[0.18em] uppercase tabular-nums">
          No graph yet
        </p>
        <h3 className="text-foreground mt-2 text-xl font-medium tracking-tight">
          Generate from the current source.
        </h3>
        <p className="text-muted-foreground mx-auto mt-3 max-w-[44ch] text-sm leading-relaxed">
          Use the chat on the right to run a fresh extraction. Concepts and relationship edges will
          stream in as the agent reads the material.
        </p>
      </div>
    </div>
  );
}
