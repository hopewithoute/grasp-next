import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/server/actor";
import { createProjectDeps } from "@/server/project-deps";
import { ProjectStatusBadge } from "./project-status-badge";
import { SourceMaterialForm } from "./source-material-form";

type ProjectDetailPageProps = {
  projectId: string;
};

export async function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const actor = await getActor();

  if (!actor) {
    redirect("/sign-in");
  }

  const project = await createProjectDeps().projectRepository.findByIdForOwner(
    projectId,
    actor.id
  );

  if (!project) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-6 py-8 text-[#171916]">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-5 border-b border-[#171916]/15 pb-6">
          <Link
            className="text-sm font-medium text-[#5c634f] hover:text-[#171916]"
            href="/dashboard/projects"
          >
            Back to projects
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.24em] text-[#5c634f] uppercase">
                Source material
              </p>
              <h1 className="text-3xl font-semibold">{project.title}</h1>
              {project.description ? (
                <p className="max-w-2xl text-sm leading-6 text-[#5c634f]">
                  {project.description}
                </p>
              ) : null}
            </div>
            <ProjectStatusBadge status={project.status} />
          </div>
        </header>

        <section className="rounded-md border border-[#171916]/15 bg-white p-5 shadow-[6px_6px_0_#d7e0bf]">
          <SourceMaterialForm
            projectId={project.id}
            sourceMaterial={project.sourceMaterial}
          />
        </section>
      </div>
    </main>
  );
}
