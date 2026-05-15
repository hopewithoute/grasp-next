'use server';

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { loadProjectDetail, ProjectForbiddenError, ProjectNotFoundError } from '@grasp/domain';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { ProjectStatusBadge } from './project-status-badge';
import { ConceptGraphReview } from './concept-graph-review';
import { DeleteProjectForm, ProjectDetailsForm } from './project-lifecycle-forms';
import { RetryExtractionForm } from './retry-extraction-form';
import { SourceMaterialForm } from './source-material-form';

type ProjectDetailPageProps = {
  projectId: string;
};

export async function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const actor = await getActor();

  if (!actor) {
    redirect('/sign-in');
  }

  const deps = createProjectDeps();

  let detail;

  try {
    detail = await loadProjectDetail(
      { projectId, ownerId: actor.id },
      {
        artifactRepository: deps.artifactRepository,
        conceptRepository: deps.conceptRepository,
        projectRepository: deps.projectRepository,
      }
    );
  } catch (error) {
    if (error instanceof ProjectNotFoundError || error instanceof ProjectForbiddenError) {
      notFound();
    }

    throw error;
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
              <h1 className="text-3xl font-semibold">{detail.project.title}</h1>
              {detail.project.description ? (
                <p className="max-w-2xl text-sm leading-6 text-[#5c634f]">
                  {detail.project.description}
                </p>
              ) : null}
            </div>
            <ProjectStatusBadge status={detail.project.status} />
          </div>
        </header>

        <section className="rounded-md border border-[#171916]/15 bg-white p-5 shadow-[6px_6px_0_#efe2a8]">
          <div className="mb-5 flex flex-col gap-4 border-b border-[#171916]/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.24em] text-[#5c634f] uppercase">
                Project lifecycle
              </p>
              <h2 className="text-xl font-semibold">Project details</h2>
            </div>
            <DeleteProjectForm
              disabled={detail.project.status === 'processing'}
              projectId={detail.project.id}
            />
          </div>
          <ProjectDetailsForm
            description={detail.project.description}
            projectId={detail.project.id}
            title={detail.project.title}
          />
        </section>

        {detail.project.status === 'failed' && detail.project.sourceMaterial ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-red-800">Extraction failed</h2>
                <p className="text-sm leading-6 text-red-700">
                  The source material is still saved. Retry extraction after fixing provider or
                  database errors.
                </p>
              </div>
              <RetryExtractionForm
                projectId={detail.project.id}
                sourceMaterial={detail.project.sourceMaterial}
              />
            </div>
          </section>
        ) : null}

        <section className="rounded-md border border-[#171916]/15 bg-white p-5 shadow-[6px_6px_0_#d7e0bf]">
          <SourceMaterialForm
            projectId={detail.project.id}
            sourceMaterial={detail.project.sourceMaterial}
          />
        </section>

        <ConceptGraphReview
          artifact={detail.conceptGraphArtifact}
          concepts={detail.concepts}
          relationships={detail.relationships}
        />
      </div>
    </main>
  );
}
