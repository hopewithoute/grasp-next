'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { buildStageHref, resolveStage, STAGE_LABELS, STAGE_ORDER } from '../stages';

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
        className="from-background pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r to-transparent md:hidden"
      />
      <nav
        aria-label="Project navigator"
        className="no-scrollbar flex w-full items-center overflow-x-auto py-1"
      >
        {STAGE_ORDER.map((stage, index) => {
          const active = stage === activeStage;
          const stageNumber = String(index + 1).padStart(2, '0');

          return (
            <div className="flex items-center" key={stage}>
              {index > 0 && (
                <span className="text-border/40 mx-3 font-mono text-xs md:mx-5">/</span>
              )}

              <Link
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex shrink-0 items-center gap-1.5 transition-all duration-300 ease-out',
                  active
                    ? 'text-foreground font-semibold drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]'
                    : 'text-muted-foreground/60 hover:text-foreground hover:opacity-100'
                )}
                href={buildStageHref(projectId, stage)}
              >
                {/* Active Left Bracket */}
                {active && (
                  <span className="text-brand-accent font-mono text-[1.1rem] leading-none font-light opacity-90">
                    [
                  </span>
                )}

                {/* Number */}
                <span
                  className={cn(
                    'font-mono text-[0.65rem] tracking-[0.2em] transition-colors',
                    active
                      ? 'text-brand-accent'
                      : 'text-muted-foreground/50 group-hover:text-muted-foreground'
                  )}
                >
                  {stageNumber}
                </span>

                {/* Label */}
                <span className="pt-[0.1rem] text-[0.65rem] tracking-[0.15em] whitespace-nowrap uppercase md:text-[0.7rem]">
                  {STAGE_LABELS[stage]}
                </span>

                {/* Active Right Bracket */}
                {active && (
                  <span className="text-brand-accent font-mono text-[1.1rem] leading-none font-light opacity-90">
                    ]
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>
      <div
        aria-hidden
        className="from-background pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l to-transparent md:hidden"
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
