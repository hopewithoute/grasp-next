import { z } from 'zod';

export const updateKnowledgebaseRelationshipEvidenceDto = z.object({
  artifactId: z.uuid(),
  blockId: z.string().trim().min(1),
  locationLabel: z.string().trim().min(1),
  originalBlockId: z.string().trim().min(1),
  originalQuote: z.string().trim().min(1).max(2000),
  originalSourceId: z.string().trim().min(1),
  quote: z.string().trim().min(1).max(2000),
  relationshipId: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
});

export type UpdateKnowledgebaseRelationshipEvidenceInput = z.infer<
  typeof updateKnowledgebaseRelationshipEvidenceDto
>;
