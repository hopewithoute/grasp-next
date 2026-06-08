'use client';

import { Plus } from 'lucide-react';
import type { ProjectSourceItem } from './source-material-form';

type SourceListProps = {
  onSelectSource: (sourceId: string) => void;
  onAddNew: () => void;
  selectedSourceId: string | null;
  sources: ProjectSourceItem[];
};

export function SourceList({
  onSelectSource,
  onAddNew,
  selectedSourceId,
  sources,
}: SourceListProps) {
  return (
    <aside className="flex h-full min-w-0 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.18em] uppercase tabular-nums">
          Sources
        </span>
        <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.16em] uppercase tabular-nums">
          {sources.length} total
        </span>
      </div>

      <button
        aria-label="Button"
        className="border-brand-accent-border/30 bg-brand-accent/[0.04] text-brand-accent-foreground hover:border-brand-accent-border hover:bg-brand-accent/[0.08] flex w-full shrink-0 items-center justify-center gap-2 rounded-[1.1rem] border border-dashed px-3 py-2.5 text-xs font-medium transition"
        onClick={onAddNew}
        type="button"
      >
        <Plus className="size-3.5" />
        Add source
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sources.length ? (
          <ul className="space-y-2">
            {sources.map((source, index) => {
              const counts = getTextCounts(source.content ?? '');

              return (
                <li key={source.id}>
                  <button
                    aria-label="Button"
                    className={`w-full rounded-[1.1rem] border px-4 py-3 text-left transition ${
                      selectedSourceId === source.id
                        ? 'border-brand-accent-border bg-brand-accent-surface'
                        : 'border-border hover:bg-muted/50 bg-white/[0.035]'
                    }`}
                    onClick={() => onSelectSource(source.id)}
                    type="button"
                  >
                    <span className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-foreground truncate text-sm font-medium">
                        {source.title}
                      </span>
                      <span className="text-muted-foreground font-mono text-[0.6rem]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </span>
                    <span className="text-muted-foreground line-clamp-2 text-xs leading-5">
                      {getSourcePreview(source.content)}
                    </span>
                    <span className="text-foreground/38 mt-3 flex items-center justify-between font-mono text-[0.6rem] tracking-[0.14em] uppercase">
                      <span>{source.type}</span>
                      <span>{counts.words} words</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border-border bg-card/50 text-muted-foreground rounded-[1.1rem] border border-dashed px-4 py-5 text-sm leading-6">
            No sources yet. Add markdown or pasted text above.
          </div>
        )}
      </div>
    </aside>
  );
}

function getSourcePreview(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return 'Empty source';
  }
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function getTextCounts(value: string) {
  const trimmed = value.trim();
  return {
    characters: value.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
  };
}
