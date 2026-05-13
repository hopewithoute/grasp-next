import { createProjectDto, type CreateProjectDto } from "./project.dto";
import type {
  AuditLogRepository,
  ProjectRecord,
  ProjectRepository,
} from "./project.types";

export type CreateProjectDeps = {
  auditLogRepository: AuditLogRepository;
  projectRepository: ProjectRepository;
};

export async function createProject(
  input: CreateProjectDto,
  deps: CreateProjectDeps,
  actorId?: string
): Promise<ProjectRecord> {
  const dto = createProjectDto.parse(input);

  const project = await deps.projectRepository.create({
    title: dto.title,
    description: dto.description,
    sourceMaterial: dto.sourceMaterial,
  });

  await deps.auditLogRepository.write({
    actorId,
    action: "project.created",
    entityType: "project",
    entityId: project.id,
  });

  return project;
}
