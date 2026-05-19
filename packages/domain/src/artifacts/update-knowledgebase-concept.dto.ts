import { z } from 'zod';
import { conceptDifficultyDto } from '../concepts';

export const updateKnowledgebaseConceptDto = z.object({
  artifactId: z.uuid(),
  conceptId: z.string().trim().min(1),
  definition: z.string().trim().min(1).max(2000),
  difficulty: conceptDifficultyDto,
  name: z.string().trim().min(1).max(160),
});

export type UpdateKnowledgebaseConceptInput = z.infer<typeof updateKnowledgebaseConceptDto>;
