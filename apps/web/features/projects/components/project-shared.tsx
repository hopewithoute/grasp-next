import { ArrowUpRight, CheckCircle2, CircleDashed } from 'lucide-react';
import Link from 'next/link';
import { statusChipVariants } from '../project-style-variants';
import type { StudioStage } from '../stages';

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase text-muted-foreground">
      <span className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
      <span className="font-mono">{children}</span>
    </span>
  );
}

export function StatusChip({ ready }: { ready: boolean }) {
  return (
    <span className={statusChipVariants({ ready })}>
      {ready ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}
      {ready ? 'Ready' : 'Pending'}
    </span>
  );
}

export function NextActionCell({
  copy,
  href,
  stageLabel,
  title,
}: {
  copy: string;
  href: string;
  stageLabel: string;
  title: string;
}) {
  return (
    <Link
      className="group relative flex h-full flex-col justify-between gap-2.5 bg-card/50 p-3.5 transition-colors hover:bg-card"
      href={href}
    >
      <span
        aria-hidden
        className="absolute top-3.5 bottom-3.5 left-0 w-px rounded-full bg-brand-accent"
      />
      <div className="space-y-2 pl-3">
        <span className="font-mono text-[0.58rem] tabular-nums tracking-[0.2em] uppercase text-brand-accent-foreground">
          Next action
        </span>
        <h2 className="text-base leading-[1.15] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="max-w-[46ch] text-xs leading-relaxed text-muted-foreground">{copy}</p>
      </div>

      <span className="inline-flex items-center gap-2 pl-3 text-xs font-medium text-brand-accent-foreground transition-colors group-hover:text-brand-accent">
        Open {stageLabel}
        <ArrowUpRight
          className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          strokeWidth={1.5}
        />
      </span>
    </Link>
  );
}

export function StatusCell({
  label,
  ready,
  statHint,
  statValue,
  unit,
}: {
  label: string;
  ready: boolean;
  statHint: string;
  statValue: string;
  unit: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-3 bg-card/50 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.58rem] tabular-nums tracking-[0.2em] uppercase text-muted-foreground">
          {label}
        </span>
        <StatusChip ready={ready} />
      </div>

      <div className="space-y-0.5">
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-medium tabular-nums tracking-tight text-foreground">
            {statValue}
          </span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{statHint}</p>
      </div>
    </div>
  );
}
