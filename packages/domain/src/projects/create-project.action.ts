import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants';
import { type CreateProjectDto } from './project.dto';
import type { AuditLogRepository, ProjectRecord, ProjectRepository } from './project.types';

export type CreateProjectDeps = {
  auditLogRepository: AuditLogRepository;
  projectRepository: ProjectRepository;
};

export async function createProject(
  input: CreateProjectDto,
  deps: CreateProjectDeps,
  actorId: string
): Promise<ProjectRecord> {
  const project = await deps.projectRepository.create({
    ownerId: actorId,
    title: input.title,
    description: input.description,
  });

  await deps.auditLogRepository.write({
    actorId,
    action: AUDIT_ACTION.PROJECT_CREATED,
    entityType: AUDIT_ENTITY_TYPE.PROJECT,
    entityId: project.id,
  });

  return project;
}
