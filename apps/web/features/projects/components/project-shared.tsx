export { StatusChip } from './status-chip';
export { StatusCell } from './status-cell';

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase text-muted-foreground">
      <span className="size-1.5 rounded-full bg-brand-accent pulse-soft" />
      <span className="font-mono">{children}</span>
    </span>
  );
}
