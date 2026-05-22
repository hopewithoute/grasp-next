import { z } from 'zod';
import { knowledgebaseRelationshipTypeDto } from '../knowledgebase';

export const updateKnowledgebaseRelationshipDto = z.object({
  artifactId: z.uuid(),
  relationshipId: z.string().trim().min(1),
  relationshipType: knowledgebaseRelationshipTypeDto,
  sourceConceptId: z.string().trim().min(1),
  targetConceptId: z.string().trim().min(1),
});

export type UpdateKnowledgebaseRelationshipInput = z.infer<
  typeof updateKnowledgebaseRelationshipDto
>;
