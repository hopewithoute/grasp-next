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
  'rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
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
  'w-full resize-y rounded-[1.25rem] border border-white/10 bg-[#0d1824] px-4 py-4 text-sm leading-6 text-[#f3efe3] outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-[#f3efe3]/36 focus-visible:border-[#53d1cb]/60 focus-visible:ring-3 focus-visible:ring-[#53d1cb]/18',
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

export const sourceModeButtonVariants = cva('rounded-full px-2.5 py-1 transition-colors', {
  variants: {
    active: {
      false: 'text-[#f3efe3]/42 hover:text-[#f3efe3]/72',
      true: 'bg-[#53d1cb]/10 text-[#f3efe3] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
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
  'group relative flex min-w-[12rem] items-start gap-3 rounded-[1.4rem] border px-4 py-4 transition-all duration-200 hover:border-brand-accent-border hover:bg-brand-accent-surface',
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
  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
  {
    variants: {
      ready: {
        false: 'border-status-neutral-border bg-status-neutral-surface text-status-neutral-foreground',
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

export function isArtifactStatus(status: string): status is ArtifactStatus {
  return artifactStatuses.includes(status as ArtifactStatus);
}
