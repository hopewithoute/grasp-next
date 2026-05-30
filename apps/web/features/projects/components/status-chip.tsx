import { CheckCircle2, CircleDashed } from 'lucide-react';
import { statusChipVariants } from '../project-style-variants';

export function StatusChip({ ready }: { ready: boolean }) {
  return (
    <span className={statusChipVariants({ ready })}>
      {ready ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}
      {ready ? 'Ready' : 'Pending'}
    </span>
  );
}
