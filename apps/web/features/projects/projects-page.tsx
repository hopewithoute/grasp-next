import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { CreateProjectForm } from './create-project-form';
import { ProjectStatusBadge } from './project-status-badge';

export async function ProjectsPage() {
  const actor = await getActor();

  if (!actor) {
    redirect('/sign-in');
  }

  const projects = await createProjectDeps().projectRepository.listByOwner(actor.id);

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-6 py-8 text-[#171916]">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-[#171916]/15 pb-6">
          <p className="text-xs font-semibold tracking-[0.24em] text-[#5c634f] uppercase">
            Creator workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Projects</h1>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {projects.length ? (
              projects.map((project) => (
                <Card
                  className="rounded-md border border-[#171916]/10 bg-white shadow-none"
                  key={project.id}
                >
                  <CardHeader>
                    <CardTitle>
                      <Link
                        className="hover:text-[#4f5a45]"
                        href={`/dashboard/projects/${project.id}`}
                      >
                        {project.title}
                      </Link>
                    </CardTitle>
                    <CardAction>
                      <ProjectStatusBadge status={project.status} />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-[#5c634f]">
                      {project.description ? <p>{project.description}</p> : null}
                      <p>Created {formatDate(project.createdAt)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <section className="border border-dashed border-[#171916]/25 bg-white px-6 py-10">
                <div className="max-w-xl space-y-3">
                  <h2 className="text-xl font-semibold">Start with one source.</h2>
                  <p className="text-sm leading-6 text-[#5c634f]">
                    Create a project from raw notes or markdown. The next steps will extract
                    concepts, objectives, and lesson blocks from that source.
                  </p>
                </div>
              </section>
            )}
          </div>

          <aside className="h-fit rounded-md border border-[#171916]/15 bg-white p-5 shadow-[6px_6px_0_#d7e0bf]">
            <div className="mb-5 space-y-1">
              <h2 className="text-lg font-semibold">New project</h2>
              <p className="text-sm leading-6 text-[#5c634f]">
                Create the workspace and seed it with source material.
              </p>
            </div>
            <CreateProjectForm />
          </aside>
        </section>
      </div>
    </main>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(date);
}
