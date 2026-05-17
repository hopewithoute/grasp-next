import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from '../constants';
import { updateSourceMaterialDto, type UpdateSourceMaterialDto } from './project.dto';
import { canEditOwnedProject, type Actor } from './project.policy';
import type {
  AuditLogRepository,
  ProjectRecord,
  ProjectRepository,
} from './project.types';

export type SubmitSourceMaterialDeps = {
  auditLogRepository: AuditLogRepository;
  projectRepository: ProjectRepository;
};

export class ProjectNotFoundError extends Error {
  constructor() {
    super('Project not found.');
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectForbiddenError extends Error {
  constructor() {
    super('Forbidden.');
    this.name = 'ProjectForbiddenError';
  }
}

export async function submitSourceMaterial(
  input: UpdateSourceMaterialDto,
  deps: SubmitSourceMaterialDeps,
  actor: Actor
): Promise<ProjectRecord> {
  const dto = updateSourceMaterialDto.parse(input);

  const existingProject = await deps.projectRepository.findById(dto.projectId);

  if (!existingProject) {
    throw new ProjectNotFoundError();
  }

  if (!canEditOwnedProject(actor, existingProject)) {
    throw new ProjectForbiddenError();
  }

  const project = await deps.projectRepository.updateSourceMaterialForOwner(
    dto.projectId,
    actor.id,
    dto.sourceMaterial
  );

  if (!project) {
    throw new ProjectForbiddenError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: AUDIT_ACTION.PROJECT_SOURCE_MATERIAL_SUBMITTED,
    entityType: AUDIT_ENTITY_TYPE.PROJECT,
    entityId: project.id,
    metadata: {
      status: project.status,
    },
  });

  return project;
}
