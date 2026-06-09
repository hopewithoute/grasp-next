import { StatusChip } from './status-chip';

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
    <div className="border-border/40 bg-background/50 group relative flex h-full flex-col justify-between gap-6 border p-5">
      {/* Corner Accents */}
      <div className="border-muted-foreground/30 group-hover:border-brand-accent absolute top-0 left-0 size-1.5 border-t border-l transition-colors" />
      <div className="border-muted-foreground/30 group-hover:border-brand-accent absolute right-0 bottom-0 size-1.5 border-r border-b transition-colors" />

      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground/60 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
          {label}
        </span>
        <StatusChip ready={ready} />
      </div>

      <div className="space-y-1">
        <p className="flex items-baseline gap-2">
          <span className="text-foreground font-mono text-2xl font-light tracking-tighter">
            {statValue}
          </span>
          <span className="text-brand-accent/80 font-mono text-[0.65rem] tracking-widest uppercase">
            {unit}
          </span>
        </p>
        <p className="text-muted-foreground/50 font-mono text-[0.65rem] leading-relaxed tracking-wider uppercase">
          {statHint}
        </p>
      </div>
    </div>
  );
}
