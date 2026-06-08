import { requiredString, v } from '../validation';

export const normalizedSourceTypeDto = v.picklist(['markdown', 'text', 'pdf', 'video', 'web']);

export const normalizedSourceBlockKindDto = v.picklist([
  'heading',
  'paragraph',
  'list',
  'code',
  'table',
  'transcript_segment',
]);

export const normalizedSourceLocationDto = v.object({
  label: requiredString,
  pageNumber: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  timestampEndSeconds: v.optional(v.pipe(v.number(), v.minValue(0))),
  timestampStartSeconds: v.optional(v.pipe(v.number(), v.minValue(0))),
});

export const normalizedSourceBlockDto = v.object({
  id: requiredString,
  kind: normalizedSourceBlockKindDto,
  location: normalizedSourceLocationDto,
  metadata: v.optional(v.record(v.string(), v.unknown())),
  order: v.pipe(v.number(), v.integer(), v.minValue(0)),
  sourceId: v.optional(requiredString),
  text: requiredString,
});

export const normalizedSourceDto = v.object({
  blocks: v.pipe(v.array(normalizedSourceBlockDto), v.minLength(1)),
  id: requiredString,
  sourceType: normalizedSourceTypeDto,
  title: requiredString,
});

export type NormalizedSourceBlockDto = v.InferOutput<typeof normalizedSourceBlockDto>;
export type NormalizedSourceBlockKindDto = v.InferOutput<typeof normalizedSourceBlockKindDto>;
export type NormalizedSourceDto = v.InferOutput<typeof normalizedSourceDto>;
export type NormalizedSourceLocationDto = v.InferOutput<typeof normalizedSourceLocationDto>;
export type NormalizedSourceTypeDto = v.InferOutput<typeof normalizedSourceTypeDto>;
