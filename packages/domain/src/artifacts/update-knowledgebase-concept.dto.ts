import { conceptDifficultyDto } from '../concepts';
import { requiredString, uuidString, v } from '../validation';

export const updateKnowledgebaseConceptDto = v.object({
  artifactId: uuidString,
  conceptId: requiredString,
  definition: v.pipe(requiredString, v.maxLength(2000)),
  difficulty: conceptDifficultyDto,
  name: v.pipe(requiredString, v.maxLength(160)),
});

export type UpdateKnowledgebaseConceptInput = v.InferOutput<typeof updateKnowledgebaseConceptDto>;
