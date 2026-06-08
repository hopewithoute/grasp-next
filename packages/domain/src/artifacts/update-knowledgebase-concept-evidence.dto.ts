import { requiredString, uuidString, v } from '../validation';

export const updateKnowledgebaseConceptEvidenceDto = v.object({
  artifactId: uuidString,
  blockId: requiredString,
  conceptId: requiredString,
  locationLabel: requiredString,
  originalBlockId: requiredString,
  originalQuote: v.pipe(requiredString, v.maxLength(2000)),
  originalSourceId: requiredString,
  quote: v.pipe(requiredString, v.maxLength(2000)),
  sourceId: requiredString,
});

export type UpdateKnowledgebaseConceptEvidenceInput = v.InferOutput<
  typeof updateKnowledgebaseConceptEvidenceDto
>;
