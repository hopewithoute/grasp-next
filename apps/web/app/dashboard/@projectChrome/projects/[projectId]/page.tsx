import { ProjectChrome } from '@/features/projects/components/project-chrome';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';

type ProjectChromePageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

/**
 * Project-scoped slot that fills the dashboard top-header's `topBarSlot`.
 * Resolves the project title server-side so the breadcrumb superscript hydrates
 * with no client flash. Falls back to `null` (renders nothing) if the actor is
 * unauthenticated or the project is not visible to them — the underlying page
 * route still owns auth redirect / notFound handling.
 */
export default async function ProjectChromePage({ params }: ProjectChromePageProps) {
  const [{ projectId }, actor] = await Promise.all([params, getActor()]);

  if (!actor) {
    return null;
  }

  const deps = createProjectDeps();
  const project = await deps.projectRepository.findByIdForOwner(projectId, actor.id);

  if (!project) {
    return null;
  }

  return <ProjectChrome title={project.title} />;
}
