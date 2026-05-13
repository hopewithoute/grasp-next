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

export type CreateProjectDto = z.infer<typeof createProjectDto>;
export type UpdateSourceMaterialDto = z.infer<typeof updateSourceMaterialDto>;
