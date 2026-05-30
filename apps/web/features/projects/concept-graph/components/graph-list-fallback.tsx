import { Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ConceptRow } from '../types';
import { DifficultyChip, ConfidencePill } from './shared-components';

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
            <button
              aria-label="Button"
              aria-current={concept.id === selectedConceptId ? 'true' : undefined}
              className={cn(
                'flex w-full items-start gap-4 py-3.5 text-left transition-colors hover:bg-card/50',
                concept.id === selectedConceptId && 'bg-brand-accent-surface'
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

export function GraphCanvasEmpty() {
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
