import { updateProjectDetailsDto, type UpdateProjectDetailsDto } from './project.dto';
import { canEditOwnedProject, type Actor } from './project.policy';
import type { AuditLogRepository, ProjectRecord, ProjectRepository } from './project.types';
import { ProjectForbiddenError, ProjectNotFoundError } from './submit-source-material.action';

export type UpdateProjectDetailsDeps = {
  auditLogRepository: AuditLogRepository;
  projectRepository: ProjectRepository;
};

export async function updateProjectDetails(
  input: UpdateProjectDetailsDto,
  deps: UpdateProjectDetailsDeps,
  actor: Actor
): Promise<ProjectRecord> {
  const dto = updateProjectDetailsDto.parse(input);
  const existingProject = await deps.projectRepository.findById(dto.projectId);

  if (!existingProject) {
    throw new ProjectNotFoundError();
  }

  if (!canEditOwnedProject(actor, existingProject)) {
    throw new ProjectForbiddenError();
  }

  const project = await deps.projectRepository.updateDetailsForOwner(dto.projectId, actor.id, {
    description: dto.description ?? null,
    title: dto.title,
  });

  if (!project) {
    throw new ProjectForbiddenError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: 'project.details.updated',
    entityType: 'project',
    entityId: project.id,
    metadata: {
      descriptionChanged: existingProject.description !== project.description,
      titleChanged: existingProject.title !== project.title,
    },
  });

  return project;
}
