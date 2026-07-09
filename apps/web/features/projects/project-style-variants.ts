import { cva } from 'class-variance-authority';

type StatusIntent = 'danger' | 'info' | 'neutral' | 'success' | 'warning';

const artifactStatuses = [
  'approved',
  'failed',
  'generated',
  'generating',
  'needs_revision',
  'pending',
  'published',
  'rejected',
] as const;

type ArtifactStatus = (typeof artifactStatuses)[number];

const artifactStatusIntentByStatus: Record<ArtifactStatus, StatusIntent> = {
  approved: 'success',
  failed: 'danger',
  generated: 'info',
  generating: 'warning',
  needs_revision: 'warning',
  pending: 'neutral',
  published: 'success',
  rejected: 'danger',
};

export const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 border px-2 py-1 font-mono text-[0.65rem] tracking-[0.2em] uppercase',
  {
    variants: {
      intent: {
        danger:
          'border border-status-danger-border bg-status-danger-surface text-status-danger-foreground',
        info: 'border border-status-info-border bg-status-info-surface text-status-info-foreground',
        neutral:
          'border border-status-neutral-border bg-status-neutral-surface text-status-neutral-foreground',
        success:
          'border border-status-success-border bg-status-success-surface text-status-success-foreground',
        warning:
          'border border-status-warning-border bg-status-warning-surface text-status-warning-foreground',
      },
    },
    defaultVariants: {
      intent: 'neutral',
    },
  }
);

export const conceptDifficultyVariants = cva(
  'rounded-full px-2 py-1 text-xs font-medium capitalize',
  {
    variants: {
      difficulty: {
        advanced: 'bg-status-warning-surface text-status-warning-foreground',
        beginner: 'bg-status-success-surface text-status-success-foreground',
        intermediate: 'bg-status-info-surface text-status-info-foreground',
      },
    },
  }
);

export const sourceTextareaVariants = cva(
  'w-full resize-y rounded-none border border-border bg-background p-4 font-mono text-[0.8rem] leading-6 text-foreground outline-none shadow-none placeholder:text-muted-foreground/50 focus-visible:border-brand-accent focus-visible:bg-brand-accent/5',
  {
    variants: {
      compact: {
        false: 'min-h-[420px]',
        true: 'min-h-48',
      },
    },
    defaultVariants: {
      compact: false,
    },
  }
);

export const sourceModeButtonVariants = cva('rounded-none px-3 py-1 transition-colors font-mono text-[0.65rem] tracking-widest uppercase', {
  variants: {
    active: {
      false: 'text-muted-foreground/70 hover:text-foreground',
      true: 'bg-brand-accent/10 text-brand-accent border-brand-accent/50',
    },
  },
  defaultVariants: {
    active: false,
  },
});

export const chatMessageVariants = cva('rounded-[1.25rem] px-4 py-3 text-sm leading-7', {
  variants: {
    role: {
      agent: 'border border-border bg-card text-card-foreground',
      user: 'bg-brand-accent-surface text-brand-accent-foreground',
    },
  },
});

export const stageLinkVariants = cva(
  'group relative flex min-w-[12rem] items-start gap-3 rounded-[1.4rem] border p-4 transition-all duration-200 hover:border-brand-accent-border hover:bg-brand-accent-surface',
  {
    variants: {
      active: {
        false: 'border-border bg-card/5 text-muted-foreground',
        true: 'border-brand-accent-border bg-brand-accent-surface text-foreground shadow-[0_18px_40px_rgba(13,37,47,0.32)]',
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

export const stageMarkerVariants = cva(
  'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl border text-xs font-semibold',
  {
    variants: {
      active: {
        false: 'border-border bg-card/5 text-muted-foreground',
        true: 'border-brand-accent-border bg-brand-accent-surface text-brand-accent-foreground',
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

export const statusChipVariants = cva(
  'inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-[0.65rem] tracking-[0.2em] uppercase',
  {
    variants: {
      ready: {
        false:
          'border-status-neutral-border bg-status-neutral-surface text-status-neutral-foreground',
        true: 'border-status-success-border bg-status-success-surface text-status-success-foreground',
      },
    },
    defaultVariants: {
      ready: false,
    },
  }
);

export function artifactStatusVariant(status: string) {
  const intent = isArtifactStatus(status) ? artifactStatusIntentByStatus[status] : 'neutral';

  return statusBadgeVariants({ intent });
}

function isArtifactStatus(status: string): status is ArtifactStatus {
  return artifactStatuses.includes(status as ArtifactStatus);
}
