'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { BookOpen, CheckCircle2, FileText, LayoutDashboard, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildStageHref,
  resolveStage,
  STAGE_LABELS,
  STAGE_ORDER,
  type StudioStage,
} from '../stages';

const STAGE_ICONS: Record<StudioStage, typeof FileText> = {
  graph: Network,
  lesson: BookOpen,
  overview: LayoutDashboard,
  publish: CheckCircle2,
  source: FileText,
};

/**
 * Top-level Project Navigator. Renders only when the current route is a project
 * detail page; on every other dashboard route it renders nothing.
 *
 * The navigator is intentionally pathname/searchParams-driven and does not call
 * any data action, so it can mount inside the dashboard shell without
 * depending on per-project loaders.
 */
function ProjectNavigatorContent() {
  const params = useParams<{ projectId?: string }>();
  const searchParams = useSearchParams();
  const { get } = searchParams;

  const projectId = params?.projectId;
  if (!projectId) return null;

  const stageParam = get ? get.call(searchParams, 'stage') : null;
  const activeStage = resolveStage(stageParam);

  return (
    <div className="relative min-w-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-background to-transparent md:hidden"
      />
      <nav
        aria-label="Project navigator"
        className="flex w-full items-center gap-1 overflow-x-auto px-1 no-scrollbar md:px-2"
      >
        {STAGE_ORDER.map((stage, index) => {
          const Icon = STAGE_ICONS[stage];
          const active = stage === activeStage;
          const stageNumber = String(index + 1).padStart(2, '0');

          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[0.8rem] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] md:gap-2 md:px-3.5 md:text-sm',
                active
                  ? 'border-brand-accent-border bg-brand-accent-surface text-brand-accent-foreground shadow-sm'
                  : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
              href={buildStageHref(projectId, stage)}
              key={stage}
            >
              <span
                className={cn(
                  'hidden items-center gap-1.5 font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase md:inline-flex',
                  active ? 'text-brand-accent-foreground' : 'text-muted-foreground'
                )}
              >
                {stageNumber}
              </span>
              <Icon
                className={cn(
                  'size-3.5 shrink-0',
                  active
                    ? 'text-brand-accent-foreground'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
                strokeWidth={1.5}
              />
              <span
                className={cn('whitespace-nowrap', !active && 'max-[420px]:sr-only md:not-sr-only')}
              >
                {STAGE_LABELS[stage]}
              </span>
            </Link>
          );
        })}
      </nav>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-background to-transparent md:hidden"
      />
    </div>
  );
}

export function ProjectNavigator() {
  return (
    <Suspense fallback={null}>
      <ProjectNavigatorContent />
    </Suspense>
  );
}
