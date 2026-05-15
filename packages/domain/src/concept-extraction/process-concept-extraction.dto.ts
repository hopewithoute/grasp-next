import { z } from "zod";

export const processConceptExtractionDto = z.object({
  projectId: z.string().uuid(),
  sourceMaterial: z.string().trim().min(1),
  ownerId: z.string().uuid(),
  revisionFeedback: z.string().trim().optional().nullable(),
});

export type ProcessConceptExtractionInput = z.infer<
  typeof processConceptExtractionDto
>;
