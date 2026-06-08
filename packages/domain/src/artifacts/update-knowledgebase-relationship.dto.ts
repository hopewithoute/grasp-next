import { knowledgebaseRelationshipTypeDto } from '../knowledgebase';
import { requiredString, uuidString, v } from '../validation';

export const updateKnowledgebaseRelationshipDto = v.object({
  artifactId: uuidString,
  relationshipId: requiredString,
  relationshipType: knowledgebaseRelationshipTypeDto,
  sourceConceptId: requiredString,
  targetConceptId: requiredString,
});

export type UpdateKnowledgebaseRelationshipInput = v.InferOutput<
  typeof updateKnowledgebaseRelationshipDto
>;
