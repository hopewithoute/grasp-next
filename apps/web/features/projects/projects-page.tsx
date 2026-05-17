import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, FolderOpen, History, Plus, Search } from 'lucide-react';
import { PROJECT_STATUS, type ProjectStatus } from '@grasp/domain';
import { getActor, getViewer } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { CreateProjectForm } from './create-project-form';
import { ProjectStatusBadge } from './project-status-badge';

const STATUS_TONE: Record<ProjectStatus, string> = {
  [PROJECT_STATUS.DRAFT]: 'bg-[#f3efe3]/42',
  [PROJECT_STATUS.FAILED]: 'bg-[#e5685b]',
  [PROJECT_STATUS.PROCESSED]: 'bg-emerald-400',
  [PROJECT_STATUS.PROCESSING]: 'bg-[#f4b860]',
  [PROJECT_STATUS.REVIEWING]: 'bg-[#53d1cb]',
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.7rem] tracking-[0.18em] uppercase text-[#f3efe3]/62">
      <span className="size-1.5 rounded-full bg-[#53d1cb] pulse-soft" />
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
    },
  );
  const inFlight =
    counts[PROJECT_STATUS.PROCESSING] +
    counts[PROJECT_STATUS.REVIEWING];
  const greeting = greet(viewer?.name ?? null);

  return (
    <section className="flex w-full flex-col gap-10 text-[#f3efe3]">
      {/* Header — asymmetric, no card overuse */}
      <header className="grid gap-6 md:grid-cols-[1.4fr_0.6fr] md:items-end">
        <div className="space-y-4">
          <Eyebrow>Workspace · Projects</Eyebrow>
          <h1 className="max-w-[20ch] text-[clamp(2.2rem,4vw,3.6rem)] leading-[1] font-medium tracking-[-0.04em]">
            {greeting}
          </h1>
          <p className="max-w-[58ch] text-base leading-relaxed text-[#f3efe3]/62">
            Continue an open project, or seed a new one with raw source material. The pipeline
            picks up from wherever you left off.
          </p>
        </div>

        {/* Right side — counts strip, divide-y not card */}
        <dl className="grid grid-cols-3 divide-x divide-white/8 rounded-[1.75rem] border border-white/10 bg-white/[0.02] px-1 py-3">
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
              <p className="mt-1 text-sm leading-relaxed text-[#f3efe3]/52">
                {projects.length} total · {inFlight} in flight
              </p>
            </div>

            <button
              aria-label="Search projects"
              className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#f3efe3]/72 transition-colors hover:border-[#53d1cb]/24 hover:bg-[#53d1cb]/8 hover:text-[#53d1cb] active:scale-[0.96] sm:inline-flex"
              type="button"
            >
              <Search className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          {projects.length ? (
            <ol className="divide-y divide-white/8 border-y border-white/8">
              {projects.map((project) => {
                const tone = STATUS_TONE[project.status];
                const isActive =
                  project.status === PROJECT_STATUS.REVIEWING ||
                  project.status === PROJECT_STATUS.PROCESSING;

                return (
                  <li key={project.id}>
                    <Link
                      className="group relative grid gap-4 py-5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[16px_1fr_auto] sm:items-start sm:gap-5 sm:px-2"
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
                          <h3 className="truncate text-base font-medium tracking-tight text-[#f3efe3] transition-colors group-hover:text-[#f3efe3] md:text-lg">
                            {project.title}
                          </h3>
                          <ProjectStatusBadge status={project.status} />
                        </div>
                        <p className="line-clamp-2 max-w-[68ch] text-sm leading-relaxed text-[#f3efe3]/58">
                          {project.description ??
                            'No description yet. Open the project to add context and continue the workflow.'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-[0.7rem] tabular-nums text-[#f3efe3]/42">
                          <span className="inline-flex items-center gap-1.5">
                            <History className="size-3" strokeWidth={1.5} />
                            {formatDate(project.createdAt)}
                          </span>
                          <span className="text-[#f3efe3]/24">·</span>
                          <span className="font-mono uppercase tracking-[0.14em]">
                            id {project.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      <span className="flex shrink-0 items-center justify-end pt-1 text-[#f3efe3]/42 transition-colors group-hover:text-[#53d1cb]">
                        <ArrowUpRight
                          className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          strokeWidth={1.5}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-white/12 bg-white/[0.02] p-10">
              <div className="max-w-[44ch] space-y-4">
                <span className="grid size-12 place-items-center rounded-2xl border border-[#53d1cb]/24 bg-[#53d1cb]/8 text-[#53d1cb]">
                  <FolderOpen className="size-5" strokeWidth={1.5} />
                </span>
                <div className="space-y-2">
                  <h3 className="text-2xl leading-tight font-medium tracking-tight">
                    No projects yet.
                  </h3>
                  <p className="text-sm leading-relaxed text-[#f3efe3]/58">
                    Use the composer on the right to create your first project. Paste a chapter,
                    a markdown export, or notes — the pipeline starts as soon as you save.
                  </p>
                </div>
                <p className="font-mono text-[0.7rem] tracking-[0.14em] uppercase text-[#f3efe3]/42">
                  Source · Graph · Lesson · Publish
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Composer — sticky on desktop */}
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1824]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur md:p-7">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl border border-[#53d1cb]/30 bg-[#53d1cb]/8 text-[#53d1cb]">
                  <Plus className="size-4" strokeWidth={1.5} />
                </span>
                <span>
                  <span className="block font-mono text-[0.65rem] tracking-[0.18em] uppercase text-[#f3efe3]/42">
                    Composer
                  </span>
                  <span className="block text-sm font-medium tracking-tight text-[#f3efe3]">
                    New project
                  </span>
                </span>
              </div>
              <span className="font-mono text-[0.65rem] tabular-nums tracking-[0.14em] uppercase text-[#f3efe3]/42">
                step 01
              </span>
            </header>

            <p className="mt-5 max-w-[42ch] text-sm leading-relaxed text-[#f3efe3]/62">
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
      <p className="font-mono text-[0.65rem] tabular-nums tracking-[0.16em] uppercase text-[#f3efe3]/42">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-medium tabular-nums tracking-tight ${
          accent ? 'text-[#53d1cb]' : 'text-[#f3efe3]'
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(date);
}
