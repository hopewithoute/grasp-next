import Link from 'next/link';
import { ProjectNavigator } from '@/features/projects/components/project-navigator';

export default function ProjectChromeLoading() {
  return (
    <div className="border-border/40 bg-background/60 sticky top-[104px] z-20 flex min-h-[48px] items-center justify-center border-b px-4 py-3 backdrop-blur-2xl md:px-8 lg:px-12 xl:px-16">
      <div className="relative flex w-full max-w-[1600px] min-w-0 items-center py-1">
        {/* Desktop Left: Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="text-muted-foreground hidden min-w-0 shrink-0 items-center gap-2 font-mono text-[0.65rem] tracking-[0.18em] uppercase md:flex"
        >
          <Link className="hover:text-foreground transition-colors" href="/dashboard/projects">
            Projects
          </Link>
          <span aria-hidden className="text-muted-foreground/50">
            /
          </span>
          {/* Skeleton Title */}
          <div className="bg-muted/50 h-3 w-32 animate-pulse rounded-none" />
        </nav>

        {/* Desktop Center: Navigator Pills (these hydrate instantly on client) */}
        <div className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
          <ProjectNavigator />
        </div>

        {/* Mobile View */}
        <div className="flex w-full min-w-0 items-center justify-between gap-4 md:hidden">
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <span className="bg-muted pulse-soft size-1.5 shrink-0 rounded-full" />
            <div className="bg-muted/50 h-4 w-24 animate-pulse rounded-none" />
          </div>
          <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
            <ProjectNavigator />
          </div>
        </div>
      </div>
    </div>
  );
}
