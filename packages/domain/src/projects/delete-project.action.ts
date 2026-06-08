import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, PROJECT_STATUS } from '../constants';
import { type DeleteProjectDto } from './project.dto';
import { ProjectForbiddenError, ProjectNotFoundError } from './project.errors';
import { canEditOwnedProject, type Actor } from './project.policy';
import type { AuditLogRepository, ProjectRecord, ProjectRepository } from './project.types';

export type DeleteProjectDeps = {
  auditLogRepository: AuditLogRepository;
  projectRepository: ProjectRepository;
};

export class ProjectDeleteBlockedError extends Error {
  constructor() {
    super('Project cannot be deleted while processing.');
    this.name = 'ProjectDeleteBlockedError';
  }
}

export async function deleteProject(
  input: DeleteProjectDto,
  deps: DeleteProjectDeps,
  actor: Actor
): Promise<ProjectRecord> {
  const existingProject = await deps.projectRepository.findById(input.projectId);

  if (!existingProject) {
    throw new ProjectNotFoundError();
  }

  if (!canEditOwnedProject(actor, existingProject)) {
    throw new ProjectForbiddenError();
  }

  if (existingProject.status === PROJECT_STATUS.PROCESSING) {
    throw new ProjectDeleteBlockedError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: AUDIT_ACTION.PROJECT_DELETED,
    entityType: AUDIT_ENTITY_TYPE.PROJECT,
    entityId: existingProject.id,
    metadata: {
      status: existingProject.status,
      title: existingProject.title,
    },
  });

  const deletedProject = await deps.projectRepository.deleteForOwner(input.projectId, actor.id);

  if (!deletedProject) {
    throw new ProjectForbiddenError();
  }

  return deletedProject;
}
