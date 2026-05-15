import { and, desc, eq } from 'drizzle-orm';
import type { DbClient } from './client';
import { projects, type NewProject, type Project } from './schema';

export type ProjectRepository = ReturnType<typeof createProjectRepository>;

export function createProjectRepository(db: DbClient) {
  return {
    async create(input: Pick<NewProject, 'description' | 'ownerId' | 'sourceMaterial' | 'title'>) {
      const [project] = await db
        .insert(projects)
        .values({
          ownerId: input.ownerId,
          title: input.title,
          description: input.description,
          sourceMaterial: input.sourceMaterial,
        })
        .returning();

      return project;
    },

    async findById(projectId: string) {
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

      return project ?? null;
    },

    async findByIdForOwner(projectId: string, ownerId: string) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
        .limit(1);

      return project ?? null;
    },

    async listByOwner(ownerId: string) {
      return db
        .select()
        .from(projects)
        .where(eq(projects.ownerId, ownerId))
        .orderBy(desc(projects.createdAt));
    },

    async updateDetailsForOwner(
      projectId: string,
      ownerId: string,
      input: {
        description?: string | null;
        title: string;
      }
    ) {
      const [project] = await db
        .update(projects)
        .set({
          description: input.description ?? null,
          title: input.title,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
        .returning();

      return project ?? null;
    },

    async updateSourceMaterial(projectId: string, sourceMaterial: string) {
      const [project] = await db
        .update(projects)
        .set({
          sourceMaterial,
          status: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId))
        .returning();

      return project ?? null;
    },

    async updateSourceMaterialForOwner(projectId: string, ownerId: string, sourceMaterial: string) {
      const [project] = await db
        .update(projects)
        .set({
          sourceMaterial,
          status: 'processing',
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
        .returning();

      return project ?? null;
    },

    async updateStatus(projectId: string, status: Project['status']) {
      const [project] = await db
        .update(projects)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId))
        .returning();

      return project ?? null;
    },

    async deleteForOwner(projectId: string, ownerId: string) {
      const [project] = await db
        .delete(projects)
        .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
        .returning();

      return project ?? null;
    },
  };
}
