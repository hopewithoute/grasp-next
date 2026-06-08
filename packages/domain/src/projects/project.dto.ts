import { requiredString, uuidString, v } from '../validation';

const requiredText = requiredString;

export const createProjectDto = v.object({
  title: v.pipe(requiredText, v.maxLength(160)),
  description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(1_000))),
});

export const updateProjectDetailsDto = v.object({
  description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(1_000))),
  projectId: uuidString,
  title: v.pipe(requiredText, v.maxLength(160)),
});

export const deleteProjectDto = v.object({
  projectId: uuidString,
});

export type CreateProjectDto = v.InferOutput<typeof createProjectDto>;
export type DeleteProjectDto = v.InferOutput<typeof deleteProjectDto>;
export type UpdateProjectDetailsDto = v.InferOutput<typeof updateProjectDetailsDto>;
