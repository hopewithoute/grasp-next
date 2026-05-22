import { z } from 'zod';

export const updateKnowledgebaseConceptEvidenceDto = z.object({
  artifactId: z.uuid(),
  blockId: z.string().trim().min(1),
  conceptId: z.string().trim().min(1),
  locationLabel: z.string().trim().min(1),
  originalBlockId: z.string().trim().min(1),
  originalQuote: z.string().trim().min(1).max(2000),
  originalSourceId: z.string().trim().min(1),
  quote: z.string().trim().min(1).max(2000),
  sourceId: z.string().trim().min(1),
});

export type UpdateKnowledgebaseConceptEvidenceInput = z.infer<
  typeof updateKnowledgebaseConceptEvidenceDto
>;
