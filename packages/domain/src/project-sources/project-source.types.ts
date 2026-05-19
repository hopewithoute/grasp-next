import type { ProjectSourceType } from '../constants';

export type ProjectSourceRecord = {
  id: string;
  projectId: string;
  type: ProjectSourceType;
  title: string;
  content: string | null;
  fileRef: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectSourceRepository = {
  createForProjectOwner(
    projectId: string,
    ownerId: string,
    input: {
      content?: string | null;
      fileRef?: string | null;
      metadata?: unknown;
      title: string;
      type: ProjectSourceType;
    }
  ): Promise<ProjectSourceRecord | null>;
  deleteForProjectOwner(sourceId: string, ownerId: string): Promise<ProjectSourceRecord | null>;
  listByProject(projectId: string): Promise<ProjectSourceRecord[]>;
  listByProjectForOwner(projectId: string, ownerId: string): Promise<ProjectSourceRecord[]>;
  updateForProjectOwner(
    sourceId: string,
    ownerId: string,
    input: {
      content?: string | null;
      fileRef?: string | null;
      metadata?: unknown;
      title: string;
      type: ProjectSourceType;
    }
  ): Promise<ProjectSourceRecord | null>;
};
