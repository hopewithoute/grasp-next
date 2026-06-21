import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants';

import { ProjectForbiddenError } from '../projects/project.errors';
import { canEditOwnedProject, type Actor } from '../projects/project.policy';
import type { AuditLogRepository, ProjectRepository } from '../projects/project.types';
import {
  type AddProjectSourceDto,
  type AddProjectSourceFromUrlDto,
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
  const project = await deps.projectRepository.findById(input.projectId);

  if (!project || !canEditOwnedProject(actor, project)) {
    throw new ProjectForbiddenError();
  }

  const source = await deps.projectSourceRepository.createForProjectOwner(
    input.projectId,
    actor.id,
    {
      content: input.content,
      title: input.title,
      type: input.type,
    }
  );

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

export async function addProjectSourceFromUrl(
  input: AddProjectSourceFromUrlDto & { content: string },
  deps: ProjectSourceActionDeps,
  actor: Actor
): Promise<ProjectSourceRecord> {
  const project = await deps.projectRepository.findById(input.projectId);

  if (!project || !canEditOwnedProject(actor, project)) {
    throw new ProjectForbiddenError();
  }

  const source = await deps.projectSourceRepository.createForProjectOwner(
    input.projectId,
    actor.id,
    {
      content: input.content,
      fileRef: input.url,
      title: input.title,
      type: 'web',
    }
  );

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
      fileRef: input.url,
    },
  });

  return source;
}

export async function updateProjectSource(
  input: UpdateProjectSourceDto,
  deps: ProjectSourceActionDeps,
  actor: Actor
): Promise<ProjectSourceRecord> {
  const source = await deps.projectSourceRepository.updateForProjectOwner(
    input.sourceId,
    actor.id,
    {
      content: input.content,
      title: input.title,
      type: input.type,
    }
  );

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
  const source = await deps.projectSourceRepository.deleteForProjectOwner(input.sourceId, actor.id);

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
