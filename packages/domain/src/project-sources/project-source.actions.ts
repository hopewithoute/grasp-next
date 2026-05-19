import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants';
import { ProjectForbiddenError } from '../projects/project.errors';
import { canEditOwnedProject, type Actor } from '../projects/project.policy';
import type { AuditLogRepository, ProjectRepository } from '../projects/project.types';
import {
  addProjectSourceDto,
  deleteProjectSourceDto,
  updateProjectSourceDto,
  type AddProjectSourceDto,
  type DeleteProjectSourceDto,
  type UpdateProjectSourceDto,
} from './project-source.dto';
import type { ProjectSourceRecord, ProjectSourceRepository } from './project-source.types';

export type ProjectSourceActionDeps = {
  auditLogRepository: AuditLogRepository;
  projectRepository: ProjectRepository;
  projectSourceRepository: ProjectSourceRepository;
};

export async function addProjectSource(
  input: AddProjectSourceDto,
  deps: ProjectSourceActionDeps,
  actor: Actor
): Promise<ProjectSourceRecord> {
  const dto = addProjectSourceDto.parse(input);
  const project = await deps.projectRepository.findById(dto.projectId);

  if (!project || !canEditOwnedProject(actor, project)) {
    throw new ProjectForbiddenError();
  }

  const source = await deps.projectSourceRepository.createForProjectOwner(dto.projectId, actor.id, {
    content: dto.content,
    title: dto.title,
    type: dto.type,
  });

  if (!source) {
    throw new ProjectForbiddenError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: AUDIT_ACTION.PROJECT_SOURCE_CREATED,
    entityType: AUDIT_ENTITY_TYPE.PROJECT,
    entityId: source.projectId,
    metadata: {
      sourceId: source.id,
      sourceType: source.type,
    },
  });

  return source;
}

export async function updateProjectSource(
  input: UpdateProjectSourceDto,
  deps: ProjectSourceActionDeps,
  actor: Actor
): Promise<ProjectSourceRecord> {
  const dto = updateProjectSourceDto.parse(input);
  const source = await deps.projectSourceRepository.updateForProjectOwner(dto.sourceId, actor.id, {
    content: dto.content,
    title: dto.title,
    type: dto.type,
  });

  if (!source) {
    throw new ProjectForbiddenError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: AUDIT_ACTION.PROJECT_SOURCE_UPDATED,
    entityType: AUDIT_ENTITY_TYPE.PROJECT,
    entityId: source.projectId,
    metadata: {
      sourceId: source.id,
      sourceType: source.type,
    },
  });

  return source;
}

export async function deleteProjectSource(
  input: DeleteProjectSourceDto,
  deps: ProjectSourceActionDeps,
  actor: Actor
): Promise<ProjectSourceRecord> {
  const dto = deleteProjectSourceDto.parse(input);
  const source = await deps.projectSourceRepository.deleteForProjectOwner(dto.sourceId, actor.id);

  if (!source) {
    throw new ProjectForbiddenError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: AUDIT_ACTION.PROJECT_SOURCE_DELETED,
    entityType: AUDIT_ENTITY_TYPE.PROJECT,
    entityId: source.projectId,
    metadata: {
      sourceId: source.id,
      sourceType: source.type,
    },
  });

  return source;
}
