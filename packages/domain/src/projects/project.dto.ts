import { z } from "zod";

const requiredText = z.string().trim().min(1);

export const createProjectDto = z.object({
  title: requiredText.max(160),
  description: z.string().trim().max(1_000).optional(),
  sourceMaterial: z.string().trim().optional(),
});

export const updateSourceMaterialDto = z.object({
  projectId: z.string().uuid(),
  sourceMaterial: requiredText,
});

export const updateProjectDetailsDto = z.object({
  description: z.string().trim().max(1_000).optional(),
  projectId: z.string().uuid(),
  title: requiredText.max(160),
});

export const deleteProjectDto = z.object({
  projectId: z.string().uuid(),
});

export type CreateProjectDto = z.infer<typeof createProjectDto>;
export type DeleteProjectDto = z.infer<typeof deleteProjectDto>;
export type UpdateProjectDetailsDto = z.infer<typeof updateProjectDetailsDto>;
export type UpdateSourceMaterialDto = z.infer<typeof updateSourceMaterialDto>;
