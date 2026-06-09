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
          [ SOURCES ]
        </span>
        <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.16em] uppercase tabular-nums">
          {sources.length} TOTAL
        </span>
      </div>

      <button
        aria-label="Button"
        className="border-brand-accent/30 bg-brand-accent/5 text-brand-accent hover:border-brand-accent/50 hover:bg-brand-accent/10 flex w-full shrink-0 items-center justify-center gap-2 rounded-none border border-dashed px-3 py-2.5 font-mono text-[0.65rem] tracking-widest uppercase transition"
        onClick={onAddNew}
        type="button"
      >
        <Plus className="size-3.5" />[ ADD SOURCE ]
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
                    className={`w-full rounded-none border px-4 py-3 text-left transition ${
                      selectedSourceId === source.id
                        ? 'border-brand-accent/50 bg-brand-accent/10'
                        : 'border-border/40 hover:bg-background/50 bg-muted/20'
                    }`}
                    onClick={() => onSelectSource(source.id)}
                    type="button"
                  >
                    <span className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-foreground truncate font-mono text-[0.65rem] tracking-widest uppercase">
                        {source.title}
                      </span>
                      <span className="text-muted-foreground/70 font-mono text-[0.6rem]">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </span>
                    <span className="text-muted-foreground/70 line-clamp-2 font-mono text-[0.6rem] leading-relaxed uppercase">
                      {getSourcePreview(source.content)}
                    </span>
                    <span className="text-foreground/50 mt-3 flex items-center justify-between font-mono text-[0.6rem] tracking-[0.14em] uppercase">
                      <span>[{source.type}]</span>
                      <span>{counts.words} WORDS</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border-border/40 bg-background/50 text-muted-foreground/70 rounded-none border border-dashed px-4 py-5 font-mono text-[0.65rem] leading-6 tracking-widest uppercase">
            [ NO SOURCES YET. ADD MARKDOWN OR PASTED TEXT ABOVE. ]
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
