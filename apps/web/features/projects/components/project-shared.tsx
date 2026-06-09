export { StatusChip } from './status-chip';
export { StatusCell } from './status-cell';

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.18em] uppercase tabular-nums">
      <span aria-hidden className="bg-brand-accent animate-pulse-soft size-1.5 rounded-none" />
      <span>[ {children} ]</span>
    </span>
  );
}
