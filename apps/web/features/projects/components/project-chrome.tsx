import Link from 'next/link';
import { ProjectNavigator } from './project-navigator';

type ProjectChromeProps = {
  title: string;
};

/**
 * Two-row project chrome rendered inside the dashboard top header:
 *   1. Breadcrumb superscript (Projects / {title})
 *   2. Stage navigator pills (Overview · Workspace · Lesson · Publish)
 *
 * Server component on purpose — the title is server-fetched in the parallel
 * route slot, so the breadcrumb has no hydration flash. The existing
 * <ProjectNavigator/> client component is composed in for the stage tabs and
 * derives its projectId/active-stage from the URL via `useParams`.
 */
export function ProjectChrome({ title }: ProjectChromeProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 md:gap-1.5">
      <div className="flex min-w-0 items-center gap-2 md:hidden">
        <span className="bg-brand-accent pulse-soft size-1.5 shrink-0 rounded-full" />
        <h1 className="text-foreground min-w-0 truncate text-sm font-medium tracking-tight">
          {title}
        </h1>
      </div>
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground hidden min-w-0 items-center gap-2 px-2 font-mono text-[0.6rem] tracking-[0.18em] uppercase md:flex"
      >
        <Link className="hover:text-foreground transition-colors" href="/dashboard/projects">
          Projects
        </Link>
        <span aria-hidden className="text-muted-foreground/50">
          /
        </span>
        <span className="text-foreground/80 truncate tracking-normal normal-case">{title}</span>
      </nav>
      <ProjectNavigator />
    </div>
  );
}
