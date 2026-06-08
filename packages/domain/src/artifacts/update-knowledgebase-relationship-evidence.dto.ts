import { requiredString, uuidString, v } from '../validation';

export const updateKnowledgebaseRelationshipEvidenceDto = v.object({
  artifactId: uuidString,
  blockId: requiredString,
  locationLabel: requiredString,
  originalBlockId: requiredString,
  originalQuote: v.pipe(requiredString, v.maxLength(2000)),
  originalSourceId: requiredString,
  quote: v.pipe(requiredString, v.maxLength(2000)),
  relationshipId: requiredString,
  sourceId: requiredString,
});

export type UpdateKnowledgebaseRelationshipEvidenceInput = v.InferOutput<
  typeof updateKnowledgebaseRelationshipEvidenceDto
>;
