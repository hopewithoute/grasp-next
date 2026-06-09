import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, Search } from 'lucide-react';
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
      {/* Header — High-Tech Geometry Style */}
      <header className="border-border/40 relative mb-4 flex flex-col gap-8 border-b pb-10">
        {/* Glowing Bottom Border Accent */}
        <div className="from-brand-accent/80 absolute -bottom-[0.5px] left-0 h-[1px] w-1/3 bg-gradient-to-r to-transparent" />

        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3">
              <span className="bg-brand-accent animate-pulse-soft size-1.5" />
              <span className="text-brand-accent font-mono text-[0.65rem] tracking-[0.3em] uppercase">
                Terminal.Active
              </span>
            </div>
            <h1 className="max-w-[15ch] text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.9] font-light tracking-[-0.05em] uppercase">
              {greeting}
            </h1>
            <p className="text-muted-foreground/80 max-w-[50ch] font-mono text-sm leading-relaxed">
              Initialize a new node or continue existing extraction processes.
            </p>
          </div>

          {/* Right side — Terminal Stat Counters */}
          <dl className="flex flex-wrap gap-8 lg:gap-12">
            <CountCell label="Total" value={projects.length} />
            <CountCell accent label="In review" value={counts[PROJECT_STATUS.REVIEWING]} />
            <CountCell label="Processing" value={counts[PROJECT_STATUS.PROCESSING]} />
          </dl>
        </div>
      </header>

      {/* Body — asymmetric 1.4fr / 0.6fr */}
      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
        {/* Projects list */}
        <div className="min-w-0 space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-mono text-lg font-light tracking-widest uppercase md:text-xl">
                [ OPEN_PROJECTS ]
              </h2>
              <p className="text-muted-foreground/80 mt-2 font-mono text-[0.65rem] tracking-widest uppercase">
                &gt; {projects.length} TOTAL // {inFlight} IN_FLIGHT
              </p>
            </div>

            <button
              aria-label="Search projects"
              className="border-border/40 bg-background/50 text-muted-foreground hover:border-brand-accent/50 hover:bg-brand-accent/10 hover:text-brand-accent hidden size-10 shrink-0 items-center justify-center rounded-none border transition-colors sm:inline-flex"
              type="button"
            >
              <Search className="size-4" strokeWidth={1} />
            </button>
          </div>

          {projects.length ? (
            <ul className="bg-border/40 border-border/40 grid grid-cols-1 gap-px border md:grid-cols-2">
              {projects.map((project) => {
                const tone = STATUS_TONE[project.status];
                const isActive =
                  project.status === PROJECT_STATUS.REVIEWING ||
                  project.status === PROJECT_STATUS.PROCESSING;

                return (
                  <li key={project.id} className="bg-background group relative">
                    <Link
                      className="hover:bg-muted/10 flex h-full flex-col gap-6 p-6 transition-colors"
                      href={`/dashboard/projects/${project.id}`}
                    >
                      {/* Corner Accents on Hover */}
                      <div className="group-hover:border-brand-accent absolute top-0 left-0 size-2 border-t border-l border-transparent transition-colors duration-300" />
                      <div className="group-hover:border-brand-accent absolute right-0 bottom-0 size-2 border-r border-b border-transparent transition-colors duration-300" />

                      <div className="flex items-start justify-between">
                        {/* Status ribbon */}
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden
                            className={`size-1.5 ${tone} ${isActive ? 'animate-pulse' : ''}`}
                          />
                          <ProjectStatusBadge status={project.status} />
                        </div>
                        <span className="text-muted-foreground/30 group-hover:text-brand-accent flex shrink-0 items-center justify-end transition-colors duration-300">
                          <ArrowUpRight
                            className="size-5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
                            strokeWidth={1}
                          />
                        </span>
                      </div>

                      <div className="mt-2 min-w-0 space-y-3">
                        <h3 className="text-foreground group-hover:text-brand-accent/90 truncate text-xl font-light tracking-tight uppercase transition-colors">
                          {project.title}
                        </h3>
                        <p className="text-muted-foreground/70 line-clamp-2 font-mono text-[0.7rem] leading-relaxed">
                          {project.description ?? 'SYS.WARN: Description missing. Awaiting input.'}
                        </p>
                      </div>

                      <div className="text-muted-foreground/50 border-border/20 mt-auto flex flex-wrap items-center justify-between border-t pt-6 font-mono text-[0.65rem]">
                        <span className="tracking-widest uppercase">
                          ID: {project.id.slice(0, 8)}
                        </span>
                        <span className="tracking-widest">{formatDate(project.createdAt)}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="border-border/40 bg-background/50 relative border p-10">
              <div className="border-muted-foreground/30 absolute top-0 left-0 size-2 border-t border-l" />
              <div className="border-muted-foreground/30 absolute right-0 bottom-0 size-2 border-r border-b" />

              <div className="max-w-[44ch] space-y-6">
                <span className="text-brand-accent font-mono text-2xl font-light">[ NULL ]</span>
                <div className="space-y-3">
                  <h3 className="text-xl font-light tracking-widest uppercase">
                    No active processes
                  </h3>
                  <p className="text-muted-foreground/70 font-mono text-xs leading-relaxed">
                    &gt; System standby.
                    <br />
                    &gt; Use the composer module to initialize a new graph extraction pipeline.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Composer — sticky on desktop */}
        <aside className="xl:sticky xl:top-28 xl:self-start">
          <article className="border-border/40 bg-background/50 relative border p-6 backdrop-blur-sm md:p-8">
            {/* High-tech corners */}
            <div className="border-muted-foreground/30 absolute top-0 left-0 size-3 border-t border-l" />
            <div className="border-muted-foreground/30 absolute top-0 right-0 size-3 border-t border-r" />
            <div className="border-muted-foreground/30 absolute bottom-0 left-0 size-3 border-b border-l" />
            <div className="border-muted-foreground/30 absolute right-0 bottom-0 size-3 border-r border-b" />

            <header className="border-border/30 mb-8 flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <span className="text-brand-accent font-mono text-sm font-light">[+]</span>
                <span className="text-foreground font-mono text-xs tracking-[0.2em] uppercase">
                  Init_Project
                </span>
              </div>
              <span className="text-muted-foreground/40 font-mono text-[0.6rem] tracking-[0.2em] uppercase">
                SEQ:01
              </span>
            </header>

            <div className="text-muted-foreground/60 mb-8 font-mono text-[0.65rem] leading-relaxed tracking-widest uppercase">
              &gt; Enter target designation.
              <br />
              &gt; System will initialize graph extraction upon commit.
            </div>

            <div>
              <CreateProjectForm />
            </div>
          </article>
        </aside>
      </section>

      {/* Abstract Node Pattern Decoration */}
      <div className="pointer-events-none fixed right-0 bottom-0 z-[-1] opacity-20">
        <svg
          width="400"
          height="400"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="200" cy="200" r="2" fill="currentColor" />
          <circle cx="100" cy="300" r="2" fill="currentColor" />
          <circle cx="300" cy="100" r="2" fill="currentColor" />
          <circle cx="250" cy="350" r="2" fill="currentColor" />
          <path
            d="M200 200 L100 300 M200 200 L300 100 M200 200 L250 350 M100 300 L250 350"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
        </svg>
      </div>
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
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground/60 font-mono text-[0.65rem] tracking-[0.2em] uppercase">
        {label}
      </p>
      <p
        className={`font-mono text-3xl font-light tracking-tighter ${
          accent
            ? 'text-brand-accent drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]'
            : 'text-foreground'
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
