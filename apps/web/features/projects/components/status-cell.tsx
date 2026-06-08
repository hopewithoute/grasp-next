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
    <div className="bg-card/50 flex h-full flex-col justify-between gap-3 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground font-mono text-[0.58rem] tracking-[0.2em] uppercase tabular-nums">
          {label}
        </span>
        <StatusChip ready={ready} />
      </div>

      <div className="space-y-0.5">
        <p className="flex items-baseline gap-2">
          <span className="text-foreground font-mono text-lg font-medium tracking-tight tabular-nums">
            {statValue}
          </span>
          <span className="text-muted-foreground text-xs">{unit}</span>
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">{statHint}</p>
      </div>
    </div>
  );
}
