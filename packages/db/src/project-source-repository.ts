import { and, asc, eq } from 'drizzle-orm';
import type { ProjectSourceType } from '@grasp/domain';
import type { DbClient } from './client';
import { projects, projectSources, type NewProjectSource } from './schema';

export type ProjectSourceRepository = ReturnType<typeof createProjectSourceRepository>;

export function createProjectSourceRepository(db: DbClient) {
  return {
    async createForProjectOwner(
      projectId: string,
      ownerId: string,
      input: Pick<NewProjectSource, 'content' | 'fileRef' | 'metadata' | 'title' | 'type'>
    ) {
      const project = await findOwnedProject(db, projectId, ownerId);

      if (!project) {
        return null;
      }

      const [source] = await db
        .insert(projectSources)
        .values({
          content: input.content ?? null,
          fileRef: input.fileRef ?? null,
          metadata: input.metadata ?? null,
          projectId,
          title: input.title,
          type: input.type,
        })
        .returning();

      return source ?? null;
    },

    async deleteForProjectOwner(sourceId: string, ownerId: string) {
      const ownedSource = await findOwnedSource(db, sourceId, ownerId);

      if (!ownedSource) {
        return null;
      }

      const [source] = await db
        .delete(projectSources)
        .where(eq(projectSources.id, sourceId))
        .returning();

      return source ?? null;
    },

    async listByProject(projectId: string) {
      return db
        .select()
        .from(projectSources)
        .where(eq(projectSources.projectId, projectId))
        .orderBy(asc(projectSources.createdAt));
    },

    async listByProjectForOwner(projectId: string, ownerId: string) {
      const project = await findOwnedProject(db, projectId, ownerId);

      if (!project) {
        return [];
      }

      return this.listByProject(projectId);
    },

    async updateForProjectOwner(
      sourceId: string,
      ownerId: string,
      input: {
        content?: string | null;
        fileRef?: string | null;
        metadata?: unknown;
        title: string;
        type: ProjectSourceType;
      }
    ) {
      const ownedSource = await findOwnedSource(db, sourceId, ownerId);

      if (!ownedSource) {
        return null;
      }

      const [source] = await db
        .update(projectSources)
        .set({
          content: input.content ?? null,
          fileRef: input.fileRef ?? null,
          metadata: input.metadata ?? null,
          title: input.title,
          type: input.type,
          updatedAt: new Date(),
        })
        .where(eq(projectSources.id, sourceId))
        .returning();

      return source ?? null;
    },
  };
}

async function findOwnedProject(db: DbClient, projectId: string, ownerId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
    .limit(1);

  return project ?? null;
}

async function findOwnedSource(db: DbClient, sourceId: string, ownerId: string) {
  const [source] = await db
    .select({ id: projectSources.id })
    .from(projectSources)
    .innerJoin(projects, eq(projectSources.projectId, projects.id))
    .where(and(eq(projectSources.id, sourceId), eq(projects.ownerId, ownerId)))
    .limit(1);

  return source ?? null;
}
