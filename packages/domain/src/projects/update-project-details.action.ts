import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants';
import { type UpdateProjectDetailsDto } from './project.dto';
import { ProjectForbiddenError, ProjectNotFoundError } from './project.errors';
import { canEditOwnedProject, type Actor } from './project.policy';
import type { AuditLogRepository, ProjectRecord, ProjectRepository } from './project.types';

export type UpdateProjectDetailsDeps = {
  auditLogRepository: AuditLogRepository;
  projectRepository: ProjectRepository;
};

export async function updateProjectDetails(
  input: UpdateProjectDetailsDto,
  deps: UpdateProjectDetailsDeps,
  actor: Actor
): Promise<ProjectRecord> {
  const existingProject = await deps.projectRepository.findById(input.projectId);

  if (!existingProject) {
    throw new ProjectNotFoundError();
  }

  if (!canEditOwnedProject(actor, existingProject)) {
    throw new ProjectForbiddenError();
  }

  const project = await deps.projectRepository.updateDetailsForOwner(input.projectId, actor.id, {
    description: input.description ?? null,
    title: input.title,
  });

  if (!project) {
    throw new ProjectForbiddenError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: AUDIT_ACTION.PROJECT_DETAILS_UPDATED,
    entityType: AUDIT_ENTITY_TYPE.PROJECT,
    entityId: project.id,
    metadata: {
      descriptionChanged: existingProject.description !== project.description,
      titleChanged: existingProject.title !== project.title,
    },
  });

  return project;
}
