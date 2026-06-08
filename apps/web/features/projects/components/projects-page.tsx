import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, FolderOpen, History, Plus, Search } from 'lucide-react';
import { PROJECT_STATUS, type ProjectStatus } from '@grasp/domain';
import { getActor, getViewer } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { CreateProjectForm } from './create-project-form';
import { ProjectStatusBadge } from './project-status-badge';

const STATUS_TONE: Record<ProjectStatus, string> = {
  [PROJECT_STATUS.DRAFT]: 'bg-status-neutral-foreground',
  [PROJECT_STATUS.FAILED]: 'bg-status-danger-foreground',
  [PROJECT_STATUS.PROCESSED]: 'bg-status-success-foreground',
  [PROJECT_STATUS.PROCESSING]: 'bg-status-warning-foreground',
  [PROJECT_STATUS.REVIEWING]: 'bg-status-info-foreground',
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase">
      <span className="bg-brand-accent pulse-soft size-1.5 rounded-full" />
      <span className="font-mono">{children}</span>
    </span>
  );
}

export async function ProjectsPage() {
  const actor = await getActor();

  if (!actor) {
    redirect('/sign-in');
  }

  const [projects, viewer] = await Promise.all([
    createProjectDeps().projectRepository.listByOwner(actor.id),
    getViewer(),
  ]);

  const counts = projects.reduce<Record<ProjectStatus, number>>(
    (accumulator, project) => {
      accumulator[project.status] = (accumulator[project.status] ?? 0) + 1;
      return accumulator;
    },
    {
      [PROJECT_STATUS.DRAFT]: 0,
      [PROJECT_STATUS.FAILED]: 0,
      [PROJECT_STATUS.PROCESSED]: 0,
      [PROJECT_STATUS.PROCESSING]: 0,
      [PROJECT_STATUS.REVIEWING]: 0,
    }
  );
  const inFlight = counts[PROJECT_STATUS.PROCESSING] + counts[PROJECT_STATUS.REVIEWING];
  const greeting = greet(viewer?.name ?? null);

  return (
    <section className="text-foreground flex w-full flex-col gap-10">
      {/* Header — asymmetric, no card overuse */}
      <header className="grid gap-6 md:grid-cols-[1.4fr_0.6fr] md:items-end">
        <div className="space-y-4">
          <Eyebrow>Workspace · Projects</Eyebrow>
          <h1 className="max-w-[20ch] text-[clamp(2.2rem,4vw,3.6rem)] leading-[1] font-medium tracking-[-0.04em]">
            {greeting}
          </h1>
          <p className="text-muted-foreground max-w-[58ch] text-base leading-relaxed">
            Continue an open project, or seed a new one with raw source material. The pipeline picks
            up from wherever you left off.
          </p>
        </div>

        {/* Right side — counts strip, divide-y not card */}
        <dl className="divide-border border-border bg-card/50 grid grid-cols-3 divide-x rounded-[1.75rem] border px-1 py-3">
          <CountCell label="Total" value={projects.length} />
          <CountCell accent label="In review" value={counts[PROJECT_STATUS.REVIEWING]} />
          <CountCell label="Processing" value={counts[PROJECT_STATUS.PROCESSING]} />
        </dl>
      </header>

      {/* Body — asymmetric 1.4fr / 0.6fr */}
      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        {/* Projects list */}
        <div className="min-w-0 space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl leading-tight font-medium tracking-tight md:text-3xl">
                Open projects
              </h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {projects.length} total · {inFlight} in flight
              </p>
            </div>

            <button
              aria-label="Search projects"
              className="border-border bg-card/50 text-muted-foreground hover:border-brand-accent-border hover:bg-brand-accent-surface hover:text-brand-accent-foreground hidden size-10 shrink-0 items-center justify-center rounded-xl border transition-colors active:scale-[0.96] sm:inline-flex"
              type="button"
            >
              <Search className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          {projects.length ? (
            <ol className="divide-border border-border divide-y border-y">
              {projects.map((project) => {
                const tone = STATUS_TONE[project.status];
                const isActive =
                  project.status === PROJECT_STATUS.REVIEWING ||
                  project.status === PROJECT_STATUS.PROCESSING;

                return (
                  <li key={project.id}>
                    <Link
                      className="group hover:bg-card/50 relative grid gap-4 py-5 transition-colors sm:grid-cols-[16px_1fr_auto] sm:items-start sm:gap-5 sm:px-2"
                      href={`/dashboard/projects/${project.id}`}
                    >
                      {/* Status ribbon — mirrors evidence-ribbon idiom */}
                      <span className="relative flex h-full justify-center pt-2 sm:pt-1.5">
                        <span
                          aria-hidden
                          className={`size-2 rounded-full ${tone} ${isActive ? 'pulse-soft' : ''}`}
                        />
                      </span>

                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-3">
                          <h3 className="text-foreground group-hover:text-foreground truncate text-base font-medium tracking-tight transition-colors md:text-lg">
                            {project.title}
                          </h3>
                          <ProjectStatusBadge status={project.status} />
                        </div>
                        <p className="text-muted-foreground line-clamp-2 max-w-[68ch] text-sm leading-relaxed">
                          {project.description ??
                            'No description yet. Open the project to add context and continue the workflow.'}
                        </p>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-[0.7rem] tabular-nums">
                          <span className="inline-flex items-center gap-1.5">
                            <History className="size-3" strokeWidth={1.5} />
                            {formatDate(project.createdAt)}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="font-mono tracking-[0.14em] uppercase">
                            id {project.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      <span className="text-muted-foreground group-hover:text-brand-accent-foreground flex shrink-0 items-center justify-end pt-1 transition-colors">
                        <ArrowUpRight
                          className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          strokeWidth={1.5}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="border-border bg-card/50 rounded-[2rem] border border-dashed p-10">
              <div className="max-w-[44ch] space-y-4">
                <span className="border-brand-accent-border bg-brand-accent-surface text-brand-accent-foreground grid size-12 place-items-center rounded-2xl border">
                  <FolderOpen className="size-5" strokeWidth={1.5} />
                </span>
                <div className="space-y-2">
                  <h3 className="text-2xl leading-tight font-medium tracking-tight">
                    No projects yet.
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Use the composer on the right to create your first project. Paste a chapter, a
                    markdown export, or notes: the pipeline starts as soon as you save.
                  </p>
                </div>
                <p className="text-muted-foreground font-mono text-[0.7rem] tracking-[0.14em] uppercase">
                  Source · Graph · Lesson · Publish
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Composer — sticky on desktop */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <article className="border-border bg-card overflow-hidden rounded-[2rem] border p-6 shadow-sm md:p-7">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="border-brand-accent-border bg-brand-accent-surface text-brand-accent-foreground grid size-8 place-items-center rounded-xl border">
                  <Plus className="size-4" strokeWidth={1.5} />
                </span>
                <span>
                  <span className="text-muted-foreground block font-mono text-[0.65rem] tracking-[0.18em] uppercase">
                    Composer
                  </span>
                  <span className="text-foreground block text-sm font-medium tracking-tight">
                    New project
                  </span>
                </span>
              </div>
              <span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.14em] uppercase tabular-nums">
                step 01
              </span>
            </header>

            <p className="text-muted-foreground mt-5 max-w-[42ch] text-sm leading-relaxed">
              Title, optional description, and seed source material. The graph extraction begins
              once you save.
            </p>

            <div className="mt-6">
              <CreateProjectForm />
            </div>
          </article>
        </aside>
      </section>
    </section>
  );
}

function CountCell({
  accent = false,
  label,
  value,
}: {
  accent?: boolean;
  label: string;
  value: number;
}) {
  return (
    <div className="px-4 py-2">
      <p className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.16em] uppercase tabular-nums">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-medium tracking-tight tabular-nums ${
          accent ? 'text-brand-accent-foreground' : 'text-foreground'
        }`}
      >
        {String(value).padStart(2, '0')}
      </p>
    </div>
  );
}

function greet(name: string | null): string {
  if (!name) return 'Open the studio.';
  const firstName = name.split(/\s+/)[0];
  return `Welcome back, ${firstName}.`;
}

const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
});

function formatDate(date: Date) {
  return dateFormatter.format(date);
}
