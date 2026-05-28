import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';
import { ChevronsLeft, ChevronsRight, CircleDashed } from 'lucide-react';
import { type ReactNode } from 'react';
import { type ConceptRow } from './types';

export function PaneHeader({
  eyebrow,
  meta,
  onCollapseToggle,
  side,
  title,
}: {
  eyebrow: string;
  meta?: ReactNode;
  onCollapseToggle?: () => void;
  side?: 'left' | 'right';
  title: string;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
      <div className="min-w-0 space-y-1">
        <span className="inline-flex items-center gap-2 font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
          {eyebrow}
        </span>
        <h2 className="truncate text-sm font-medium tracking-tight text-foreground">{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        {meta ? <div>{meta}</div> : null}
        {onCollapseToggle && side ? (
          <button aria-label={side === 'left' ? 'Collapse concept inventory' : 'Collapse refinement'}
            aria-expanded="true"
            className="inline-flex size-8 items-center justify-center rounded-xl border border-border bg-card/50 text-muted-foreground transition-colors hover:border-brand-accent-border hover:bg-brand-accent/8 hover:text-brand-accent-foreground"
            onClick={onCollapseToggle}
            type="button"
          >
            {side === 'left' ? (
              <ChevronsLeft className="size-3.5" strokeWidth={1.5} />
            ) : (
              <ChevronsRight className="size-3.5" strokeWidth={1.5} />
            )}
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function CollapsedPaneRail({
  ariaLabel,
  eyebrow,
  meta,
  onToggle,
  side,
  title,
}: {
  ariaLabel: string;
  eyebrow: string;
  meta: string;
  onToggle: () => void;
  side: 'left' | 'right';
  title: string;
}) {
  return (
    <aside
      aria-label={title}
      className={cn(
        'flex min-h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 lg:min-h-0 lg:flex-col lg:justify-start lg:border-b-0 lg:px-2 lg:py-3',
        side === 'left' ? 'lg:border-r' : 'lg:border-r-0',
      )}
    >
      <button aria-label={ariaLabel}
        aria-expanded="false"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card/50 text-muted-foreground transition-colors hover:border-brand-accent-border hover:bg-brand-accent/8 hover:text-brand-accent-foreground lg:size-10"
        onClick={onToggle}
        type="button"
      >
        {side === 'left' ? (
          <ChevronsRight className="size-4" strokeWidth={1.5} />
        ) : (
          <ChevronsLeft className="size-4" strokeWidth={1.5} />
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2 lg:min-h-0 lg:flex-none lg:flex-col">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-brand-accent pulse-soft" />
        <span className="truncate font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-muted-foreground lg:[writing-mode:vertical-rl]">
          {eyebrow}
        </span>
        <span className="truncate text-sm font-medium tracking-tight text-foreground lg:[writing-mode:vertical-rl]">
          {title}
        </span>
      </div>

      <span className="shrink-0 font-mono text-[0.62rem] tabular-nums tracking-[0.16em] uppercase text-muted-foreground lg:[writing-mode:vertical-rl]">
        {meta}
      </span>
    </aside>
  );
}

const difficultyChipVariants = cva(
  'inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[0.62rem] font-medium tracking-wide capitalize',
  {
    variants: {
      difficulty: {
        advanced: 'border-status-warning-border bg-status-warning-surface text-status-warning-foreground',
        beginner: 'border-status-success-border bg-status-success-surface text-status-success-foreground',
        intermediate: 'border-status-info-border bg-status-info-surface text-status-info-foreground',
      },
    },
  },
);

export function DifficultyChip({ difficulty }: { difficulty: ConceptRow['difficulty'] }) {
  return <span className={difficultyChipVariants({ difficulty })}>{difficulty}</span>;
}

export function ConfidencePill({ confidence, muted = false }: { confidence: string; muted?: boolean }) {
  const formatted = formatConfidence(confidence);
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-full border px-2 font-mono text-[0.62rem] tabular-nums',
        muted
          ? 'border-border bg-card/50 text-muted-foreground'
          : 'border-brand-accent-border/30 bg-brand-accent/[0.08] text-brand-accent',
      )}
      title="Confidence"
    >
      <CircleDashed className="size-3" strokeWidth={1.5} />
      {formatted}
    </span>
  );
}

export function formatConfidence(value: string): string {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 'n/a';
  return `${Math.round(confidence * 100)}%`;
}
