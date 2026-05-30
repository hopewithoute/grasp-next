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
