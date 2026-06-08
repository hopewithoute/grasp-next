import { PROJECT_SOURCE_TYPE, PROJECT_SOURCE_TYPES } from '../constants';
import { requiredString, urlString, uuidString, v } from '../validation';

const requiredText = requiredString;

export const projectSourceTypeDto = v.picklist(PROJECT_SOURCE_TYPES);

export const supportedManualProjectSourceTypeDto = v.picklist([
  PROJECT_SOURCE_TYPE.MARKDOWN,
  PROJECT_SOURCE_TYPE.TEXT,
  PROJECT_SOURCE_TYPE.WEB,
]);

export const addProjectSourceDto = v.object({
  content: requiredText,
  projectId: uuidString,
  title: v.pipe(requiredText, v.maxLength(160)),
  type: v.optional(supportedManualProjectSourceTypeDto, PROJECT_SOURCE_TYPE.MARKDOWN),
});

export const updateProjectSourceDto = v.object({
  content: requiredText,
  sourceId: uuidString,
  title: v.pipe(requiredText, v.maxLength(160)),
  type: v.optional(supportedManualProjectSourceTypeDto, PROJECT_SOURCE_TYPE.MARKDOWN),
});

export const addProjectSourceFromUrlDto = v.object({
  url: urlString,
  projectId: uuidString,
  title: v.pipe(requiredText, v.maxLength(160)),
});
export type AddProjectSourceFromUrlDto = v.InferOutput<typeof addProjectSourceFromUrlDto>;

export const deleteProjectSourceDto = v.object({
  sourceId: uuidString,
});

export type AddProjectSourceDto = v.InferOutput<typeof addProjectSourceDto>;
export type DeleteProjectSourceDto = v.InferOutput<typeof deleteProjectSourceDto>;
export type ProjectSourceTypeDto = v.InferOutput<typeof projectSourceTypeDto>;
export type UpdateProjectSourceDto = v.InferOutput<typeof updateProjectSourceDto>;
