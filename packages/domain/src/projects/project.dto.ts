import { z } from 'zod';

const requiredText = z.string().trim().min(1);

export const createProjectDto = z.object({
  title: requiredText.max(160),
  description: z.string().trim().max(1_000).optional(),
});

export const updateProjectDetailsDto = z.object({
  description: z.string().trim().max(1_000).optional(),
  projectId: z.uuid(),
  title: requiredText.max(160),
});

export const deleteProjectDto = z.object({
  projectId: z.uuid(),
});

export type CreateProjectDto = z.infer<typeof createProjectDto>;
export type DeleteProjectDto = z.infer<typeof deleteProjectDto>;
export type UpdateProjectDetailsDto = z.infer<typeof updateProjectDetailsDto>;
