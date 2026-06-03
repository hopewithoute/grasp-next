import { z } from 'zod';
import { PROJECT_SOURCE_TYPES, PROJECT_SOURCE_TYPE } from '../constants';

const requiredText = z.string().trim().min(1);

export const projectSourceTypeDto = z.enum(PROJECT_SOURCE_TYPES);

export const supportedManualProjectSourceTypeDto = z.enum([
  PROJECT_SOURCE_TYPE.MARKDOWN,
  PROJECT_SOURCE_TYPE.TEXT,
  PROJECT_SOURCE_TYPE.WEB,
]);

export const addProjectSourceDto = z.object({
  content: requiredText,
  projectId: z.uuid(),
  title: requiredText.max(160),
  type: supportedManualProjectSourceTypeDto.default(PROJECT_SOURCE_TYPE.MARKDOWN),
});

export const updateProjectSourceDto = z.object({
  content: requiredText,
  sourceId: z.uuid(),
  title: requiredText.max(160),
  type: supportedManualProjectSourceTypeDto.default(PROJECT_SOURCE_TYPE.MARKDOWN),
});

export const addProjectSourceFromUrlDto = z.object({
  url: z.string().url(),
  projectId: z.uuid(),
  title: requiredText.max(160),
});
export type AddProjectSourceFromUrlDto = z.infer<typeof addProjectSourceFromUrlDto>;

export const deleteProjectSourceDto = z.object({
  sourceId: z.uuid(),
});

export type AddProjectSourceDto = z.infer<typeof addProjectSourceDto>;
export type DeleteProjectSourceDto = z.infer<typeof deleteProjectSourceDto>;
export type ProjectSourceTypeDto = z.infer<typeof projectSourceTypeDto>;
export type UpdateProjectSourceDto = z.infer<typeof updateProjectSourceDto>;
