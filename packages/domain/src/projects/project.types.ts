export type ProjectStatus = "draft" | "processing" | "processed" | "failed";

export type ProjectRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  sourceMaterial: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectRepository = {
  create(input: {
    ownerId: string;
    title: string;
    description?: string;
    sourceMaterial?: string;
  }): Promise<ProjectRecord>;
  findById(projectId: string): Promise<ProjectRecord | null>;
  findByIdForOwner(
    projectId: string,
    ownerId: string
  ): Promise<ProjectRecord | null>;
  listByOwner(ownerId: string): Promise<ProjectRecord[]>;
  updateSourceMaterial(
    projectId: string,
    sourceMaterial: string
  ): Promise<ProjectRecord | null>;
  updateSourceMaterialForOwner(
    projectId: string,
    ownerId: string,
    sourceMaterial: string
  ): Promise<ProjectRecord | null>;
};

export type AuditLogRepository = {
  write(input: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
};

export type ConceptExtractionQueue = {
  enqueueConceptExtraction(input: { projectId: string }): Promise<void>;
};
