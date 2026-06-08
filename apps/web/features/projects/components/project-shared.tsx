export { StatusChip } from './status-chip';
export { StatusCell } from './status-cell';

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase">
      <span className="bg-brand-accent pulse-soft size-1.5 rounded-full" />
      <span className="font-mono">{children}</span>
    </span>
  );
}
