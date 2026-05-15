import { deleteProjectDto, type DeleteProjectDto } from "./project.dto";
import { canEditOwnedProject, type Actor } from "./project.policy";
import type {
  AuditLogRepository,
  ProjectRecord,
  ProjectRepository,
} from "./project.types";
import { ProjectForbiddenError, ProjectNotFoundError } from "./submit-source-material.action";

export type DeleteProjectDeps = {
  auditLogRepository: AuditLogRepository;
  projectRepository: ProjectRepository;
};

export class ProjectDeleteBlockedError extends Error {
  constructor() {
    super("Project cannot be deleted while processing.");
    this.name = "ProjectDeleteBlockedError";
  }
}

export async function deleteProject(
  input: DeleteProjectDto,
  deps: DeleteProjectDeps,
  actor: Actor
): Promise<ProjectRecord> {
  const dto = deleteProjectDto.parse(input);
  const existingProject = await deps.projectRepository.findById(dto.projectId);

  if (!existingProject) {
    throw new ProjectNotFoundError();
  }

  if (!canEditOwnedProject(actor, existingProject)) {
    throw new ProjectForbiddenError();
  }

  if (existingProject.status === "processing") {
    throw new ProjectDeleteBlockedError();
  }

  await deps.auditLogRepository.write({
    actorId: actor.id,
    action: "project.deleted",
    entityType: "project",
    entityId: existingProject.id,
    metadata: {
      status: existingProject.status,
      title: existingProject.title,
    },
  });

  const deletedProject = await deps.projectRepository.deleteForOwner(
    dto.projectId,
    actor.id
  );

  if (!deletedProject) {
    throw new ProjectForbiddenError();
  }

  return deletedProject;
}
