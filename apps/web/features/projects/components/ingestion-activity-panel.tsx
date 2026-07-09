'use client';

import { Activity, Bot, CheckCircle2, FileText, Loader2, Sparkles, XCircle } from 'lucide-react';
import type { IngestionRunRecord, ProjectSourceRecord } from '@grasp/domain';
import { cn } from '@/lib/utils';

type IngestionActivityPanelProps = {
  projectId: string;
  ingestionRuns: IngestionRunRecord[];
  sources?: ProjectSourceRecord[];
  isRunning: boolean;
};

export function IngestionActivityPanel({ ingestionRuns, sources = [], isRunning }: IngestionActivityPanelProps) {
  const getSourceName = (sourceId: string | null) => {
    if (!sourceId) return 'Unknown Source';
    const source = sources.find((s) => s.id === sourceId);
    return source ? source.title : `${String(sourceId).slice(0, 8)}...`;
  };
  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="space-y-1">
          <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-[0.62rem] tracking-[0.18em] uppercase tabular-nums">
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-none',
                isRunning ? 'bg-brand-accent animate-pulse-soft' : 'bg-brand-accent'
              )}
            />
            Tasks Queue
          </span>
          <h3 className="text-foreground font-mono text-xs tracking-widest uppercase">SYSTEM ACTIVITY</h3>
        </div>
        {isRunning && (
          <span className="border-brand-accent/50 bg-brand-accent/10 text-brand-accent inline-flex items-center gap-1.5 rounded-none border px-2.5 py-1 font-mono text-[0.6rem] tracking-widest uppercase">
            <Loader2 className="size-3 animate-spin" />[ PROCESSING ]
          </span>
        )}
      </header>

      <div className="[&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50 min-h-0 flex-1 overflow-y-scroll p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        {ingestionRuns.length === 0 ? (
          <div className="grid h-full place-items-center px-4">
            <p className="text-muted-foreground/70 text-center font-mono text-[0.65rem] leading-relaxed tracking-widest uppercase">
              [ NO INGESTION TASKS RECORDED YET ]
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {ingestionRuns.map((run) => (
              <li key={String(run.id)}>
                <TaskRunCard run={run} sourceName={getSourceName(run.sourceId)} />
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer className="border-border border-t p-3">
        <p className="text-foreground/50 font-mono text-[0.6rem] tracking-widest uppercase">
          [ BACKGROUND TASK HISTORY ]
        </p>
      </footer>
    </section>
  );
}

function TaskRunCard({ run, sourceName }: { run: IngestionRunRecord, sourceName: string }) {
  const isPending = run.status === 'ingesting';
  const isFailed = run.status === 'failed';
  const isSuccess = run.status === 'completed';

  const timeString = run.createdAt
    ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric' }).format(new Date(run.createdAt))
    : 'Unknown time';
    
  // Support both snake_case and camelCase and different property names due to Python vs NextJS domain models
  const rawStats = (run as any).stats || (run as any).metadata || {};
  const passageCount = rawStats.passageCount || rawStats.passage_count;

  return (
    <div className={cn(
      "border p-3 font-mono text-xs relative overflow-hidden",
      isPending ? "border-brand-accent/30 bg-brand-accent/5" :
      isFailed ? "border-status-danger-border bg-status-danger-surface" :
      "border-border/50 bg-white/[0.01]"
    )}>
      {isPending && (
        <div className="absolute top-0 left-0 w-full h-0.5 bg-brand-accent/20">
          <div className="h-full bg-brand-accent animate-pulse" style={{ width: '100%' }} />
        </div>
      )}
      
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          {isPending ? (
            <Loader2 className="size-3.5 text-brand-accent animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="size-3.5 text-status-success-foreground" />
          ) : (
            <XCircle className="size-3.5 text-status-danger-foreground" />
          )}
          <span className="font-semibold uppercase tracking-wider text-foreground">
            Ingestion Task
          </span>
        </div>
        <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">
          {timeString}
        </span>
      </div>

      <div className="mt-2 text-[0.65rem] text-muted-foreground/80 leading-relaxed space-y-1">
        <div className="flex items-center gap-2">
           <span className="opacity-60">SOURCE:</span>
           <span className="truncate">{sourceName}</span>
        </div>
        
        {isSuccess && passageCount !== undefined && (
           <div className="flex items-center gap-2 text-status-success-foreground/90">
             <span className="opacity-60">EXTRACTED:</span>
             <span>{passageCount} passages</span>
           </div>
        )}

        {isFailed && run.failureReason && (
           <div className="text-status-danger-foreground/90 mt-1">
             ERROR: {run.failureReason}
           </div>
        )}
        
        {isPending && (
          <div className="text-brand-accent/80 mt-1 flex items-center gap-1 animate-pulse">
             Processing document blocks...
          </div>
        )}
      </div>
    </div>
  );
}
