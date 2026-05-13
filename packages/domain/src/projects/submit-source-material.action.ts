import {
  updateSourceMaterialDto,
  type UpdateSourceMaterialDto,
} from "./project.dto";
import type {
  AuditLogRepository,
  ConceptExtractionQueue,
  ProjectRecord,
  ProjectRepository,
} from "./project.types";

export type SubmitSourceMaterialDeps = {
  auditLogRepository: AuditLogRepository;
  conceptExtractionQueue: ConceptExtractionQueue;
  projectRepository: ProjectRepository;
};

export async function submitSourceMaterial(
  input: UpdateSourceMaterialDto,
  deps: SubmitSourceMaterialDeps,
  actorId?: string
): Promise<ProjectRecord> {
  const dto = updateSourceMaterialDto.parse(input);
  const project = await deps.projectRepository.updateSourceMaterial(
    dto.projectId,
    dto.sourceMaterial
  );

  if (!project) {
    throw new Error("Project not found.");
  }

  await deps.auditLogRepository.write({
    actorId,
    action: "project.source_material.submitted",
    entityType: "project",
    entityId: project.id,
    metadata: {
      status: project.status,
    },
  });

  await deps.conceptExtractionQueue.enqueueConceptExtraction({
    projectId: project.id,
  });

  return project;
}
