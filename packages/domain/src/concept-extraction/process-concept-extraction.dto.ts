import { z } from 'zod';

export const processConceptExtractionDto = z.object({
  projectId: z.uuid(),
  sourceMaterial: z.string().trim().min(1),
  ownerId: z.uuid(),
  revisionFeedback: z.string().trim().optional().nullable(),
});

export type ProcessConceptExtractionInput = z.infer<typeof processConceptExtractionDto>;
