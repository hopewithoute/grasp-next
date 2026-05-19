import type { ProjectStatus } from '../constants';

export type { ProjectStatus } from '../constants';

export type ProjectRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectRepository = {
  create(input: {
    ownerId: string;
    title: string;
    description?: string;
  }): Promise<ProjectRecord>;
  findById(projectId: string): Promise<ProjectRecord | null>;
  findByIdForOwner(projectId: string, ownerId: string): Promise<ProjectRecord | null>;
  listByOwner(ownerId: string): Promise<ProjectRecord[]>;
  updateDetailsForOwner(
    projectId: string,
    ownerId: string,
    input: {
      description?: string | null;
      title: string;
    }
  ): Promise<ProjectRecord | null>;
  updateStatus(projectId: string, status: ProjectStatus): Promise<ProjectRecord | null>;
  deleteForOwner(projectId: string, ownerId: string): Promise<ProjectRecord | null>;
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
