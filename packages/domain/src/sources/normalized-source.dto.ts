import { z } from 'zod';

export const normalizedSourceTypeDto = z.enum(['markdown', 'text', 'pdf', 'video', 'web']);

export const normalizedSourceBlockKindDto = z.enum([
  'heading',
  'paragraph',
  'list',
  'code',
  'table',
  'transcript_segment',
]);

export const normalizedSourceLocationDto = z.object({
  label: z.string().trim().min(1),
  pageNumber: z.number().int().positive().optional(),
  timestampEndSeconds: z.number().nonnegative().optional(),
  timestampStartSeconds: z.number().nonnegative().optional(),
});

export const normalizedSourceBlockDto = z.object({
  id: z.string().trim().min(1),
  kind: normalizedSourceBlockKindDto,
  location: normalizedSourceLocationDto,
  metadata: z.record(z.string(), z.unknown()).optional(),
  order: z.number().int().nonnegative(),
  sourceId: z.string().trim().min(1).optional(),
  text: z.string().trim().min(1),
});

export const normalizedSourceDto = z.object({
  blocks: z.array(normalizedSourceBlockDto).min(1),
  id: z.string().trim().min(1),
  sourceType: normalizedSourceTypeDto,
  title: z.string().trim().min(1),
});

export type NormalizedSourceBlockDto = z.infer<typeof normalizedSourceBlockDto>;
export type NormalizedSourceBlockKindDto = z.infer<typeof normalizedSourceBlockKindDto>;
export type NormalizedSourceDto = z.infer<typeof normalizedSourceDto>;
export type NormalizedSourceLocationDto = z.infer<typeof normalizedSourceLocationDto>;
export type NormalizedSourceTypeDto = z.infer<typeof normalizedSourceTypeDto>;
