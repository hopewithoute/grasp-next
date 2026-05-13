import { eq } from "drizzle-orm";
import type { DbClient } from "./client";
import { projects, type NewProject } from "./schema";

export type ProjectRepository = ReturnType<typeof createProjectRepository>;

export function createProjectRepository(db: DbClient) {
  return {
    async create(input: Pick<NewProject, "title" | "description" | "sourceMaterial">) {
      const [project] = await db
        .insert(projects)
        .values({
          title: input.title,
          description: input.description,
          sourceMaterial: input.sourceMaterial,
        })
        .returning();

      return project;
    },

    async findById(projectId: string) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      return project ?? null;
    },

    async updateSourceMaterial(projectId: string, sourceMaterial: string) {
      const [project] = await db
        .update(projects)
        .set({
          sourceMaterial,
          status: "processing",
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId))
        .returning();

      return project ?? null;
    },
  };
}
