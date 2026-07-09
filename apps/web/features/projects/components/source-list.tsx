'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { IngestionRunRecord } from '@grasp/domain';
import { getProjectIngestionRunsAction } from '../actions';
import type { ProjectSourceItem } from './source-material-form';

type SourceListProps = {
  projectId: string;
  onSelectSource: (sourceId: string) => void;
  onEditSource: (sourceId: string) => void;
  onAddNew: () => void;
  selectedSourceId: string | null;
  sources: ProjectSourceItem[];
  ingestionRuns?: IngestionRunRecord[];
};

export function SourceList({
  projectId,
  onSelectSource,
  onEditSource,
  onAddNew,
  selectedSourceId,
  sources,
  ingestionRuns = [],
}: SourceListProps) {
  const router = useRouter();
  const [liveRuns, setLiveRuns] = useState<IngestionRunRecord[]>(ingestionRuns);

  useEffect(() => {
    setLiveRuns(ingestionRuns);
  }, [ingestionRuns]);

  useEffect(() => {
    const isAnyIngesting = liveRuns.some((r) => r.status === 'ingesting');
    if (!isAnyIngesting) return;

    const eventSource = new EventSource(`/api/projects/${projectId}/runs/events`);

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status) {
          // A run status changed, let's fetch the latest runs
          const updatedRuns = await getProjectIngestionRunsAction(projectId);
          setLiveRuns(updatedRuns);
          
          if (!updatedRuns.some((r) => r.status === 'ingesting')) {
            router.refresh();
          }
        }
      } catch (err) {
        console.error('Error handling SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      // Optional: fallback to manual polling if SSE breaks, or rely on browser's EventSource auto-reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [liveRuns, projectId, router]);

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
                  <div
                    className={`w-full rounded-none border px-4 py-3 text-left transition cursor-pointer ${
                      selectedSourceId === source.id
                        ? 'border-brand-accent/50 bg-brand-accent/10'
                        : 'border-border/40 hover:bg-background/50 bg-muted/20'
                    }`}
                    onClick={() => onSelectSource(source.id)}
                  >
                    <span className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-foreground truncate font-mono text-[0.65rem] tracking-widest uppercase">
                        {source.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-brand-accent hover:text-brand-accent-foreground font-mono text-[0.6rem] uppercase tracking-widest"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSource(source.id);
                          }}
                        >
                          [EDIT]
                        </button>
                        <span className="text-muted-foreground/70 font-mono text-[0.6rem]">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>
                    </span>
                    <span className="text-muted-foreground/70 line-clamp-2 font-mono text-[0.6rem] leading-relaxed uppercase mt-2 block">
                      {getSourcePreview(source)}
                    </span>
                    <span className="text-foreground/50 mt-3 flex items-center justify-between font-mono text-[0.6rem] tracking-[0.14em] uppercase">
                      <span className="flex items-center gap-2">
                        <span>[{source.type}]</span>
                      </span>
                      <span>
                        {(() => {
                          const latestRunForSource = liveRuns.find((r) => String(r.sourceId) === source.id);
                          if (!latestRunForSource) return null;
                          if (latestRunForSource.status === 'ingesting') {
                            return <span className="text-brand-accent animate-pulse">INGESTING...</span>;
                          }
                          if (latestRunForSource.status === 'completed') {
                            return <span className="text-status-success-foreground">PROCESSED</span>;
                          }
                          if (latestRunForSource.status === 'failed') {
                            return <span className="text-status-danger-foreground">FAILED</span>;
                          }
                          return null;
                        })()}
                      </span>
                    </span>
                  </div>
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

function getSourcePreview(source: { content: string | null; type: string }) {
  if (source.type === 'pdf') {
    return '[PDF Document]';
  }
  const trimmed = source.content?.trim();
  if (!trimmed) {
    return 'Empty source';
  }
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}
