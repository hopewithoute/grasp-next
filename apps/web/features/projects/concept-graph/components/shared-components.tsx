import { type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { ChevronsLeft, ChevronsRight, CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ConceptRow } from '../types';

export function PaneHeader({
  meta,
  actions,
  onCollapseToggle,
  side,
  title,
}: {
  meta?: ReactNode;
  actions?: ReactNode;
  onCollapseToggle?: () => void;
  side?: 'left' | 'right';
  title: string;
}) {
  return (
    <header className="border-border/40 flex items-center justify-between gap-3 border-b border-dashed px-4 py-3.5">
      <div className="min-w-0">
        <span className="text-foreground/80 whitespace-nowrap inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.2em] uppercase tabular-nums">
          <span aria-hidden className="bg-brand-accent animate-pulse-soft shrink-0 size-1.5" />
          <span className="truncate">{title}</span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs">
        {meta ? <div className="text-muted-foreground font-mono text-[0.62rem] tracking-[0.2em] uppercase">{meta}</div> : null}
        {actions ? <div className="flex items-center">{actions}</div> : null}
        {onCollapseToggle && side ? (
          <button
            aria-label={side === 'left' ? 'Collapse concept inventory' : 'Collapse refinement'}
            aria-expanded="true"
            className="border-border/40 bg-background/50 text-muted-foreground hover:border-brand-accent/50 hover:bg-brand-accent/10 hover:text-brand-accent inline-flex size-8 items-center justify-center rounded-none border transition-colors"
            onClick={onCollapseToggle}
            type="button"
          >
            {side === 'left' ? (
              <ChevronsLeft className="size-3" strokeWidth={1} />
            ) : (
              <ChevronsRight className="size-3" strokeWidth={1} />
            )}
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function CollapsedPaneRail({
  ariaLabel,
  meta,
  onToggle,
  side,
  title,
}: {
  ariaLabel: string;
  meta: string;
  onToggle: () => void;
  side: 'left' | 'right';
  title: string;
}) {
  return (
    <aside
      aria-label={title}
      className={cn(
        'border-border/40 bg-background/50 flex min-h-16 items-center justify-between gap-3 border-b border-dashed px-4 py-3 lg:min-h-0 lg:flex-col lg:justify-start lg:border-b-0 lg:px-2 lg:py-3',
        side === 'left' ? 'lg:border-r' : 'lg:border-r-0 lg:border-l'
      )}
    >
      <button
        aria-label={ariaLabel}
        aria-expanded="false"
        className="border-border/40 bg-background/50 text-muted-foreground hover:border-brand-accent/50 hover:bg-brand-accent/10 hover:text-brand-accent inline-flex size-9 shrink-0 items-center justify-center rounded-none border transition-colors lg:size-10"
        onClick={onToggle}
        type="button"
      >
        {side === 'left' ? (
          <ChevronsRight className="size-3" strokeWidth={1} />
        ) : (
          <ChevronsLeft className="size-3" strokeWidth={1} />
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2 lg:min-h-0 lg:flex-none lg:flex-col">
        <span aria-hidden className="bg-brand-accent animate-pulse-soft size-1.5 shrink-0" />
        <span className="text-foreground/80 truncate font-mono text-[0.65rem] tracking-[0.2em] uppercase tabular-nums lg:[writing-mode:vertical-rl]">
          {title}
        </span>
      </div>

      <span className="text-brand-accent/50 shrink-0 font-mono text-[0.62rem] tracking-[0.2em] uppercase tabular-nums lg:[writing-mode:vertical-rl]">
        {meta}
      </span>
    </aside>
  );
}

const difficultyChipVariants = cva(
  'inline-flex h-5 items-center gap-1 border px-2 font-mono text-[0.62rem] tracking-[0.2em] uppercase rounded-none whitespace-nowrap',
  {
    variants: {
      difficulty: {
        advanced:
          'border-status-warning-border bg-status-warning-surface text-status-warning-foreground',
        beginner:
          'border-status-success-border bg-status-success-surface text-status-success-foreground',
        intermediate:
          'border-status-info-border bg-status-info-surface text-status-info-foreground',
      },
    },
  }
);

export function DifficultyChip({ difficulty }: { difficulty: ConceptRow['difficulty'] }) {
  return (
    <span className={difficultyChipVariants({ difficulty })}>[ {difficulty.toUpperCase()} ]</span>
  );
}

export function ConfidencePill({
  confidence,
  muted = false,
}: {
  confidence: string;
  muted?: boolean;
}) {
  const formatted = formatConfidence(confidence);
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-none border px-2 font-mono text-[0.62rem] tracking-[0.2em] uppercase tabular-nums whitespace-nowrap',
        muted
          ? 'border-border/40 bg-background/50 text-muted-foreground/70'
          : 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent'
      )}
      title="Confidence"
    >
      <CircleDashed className="size-3" strokeWidth={1} />[ {formatted} ]
    </span>
  );
}

function formatConfidence(value: string): string {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 'n/a';
  return `${Math.round(confidence * 100)}%`;
}
