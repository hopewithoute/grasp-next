import { z } from 'zod';

export const conceptDifficultyDto = z.enum(['beginner', 'intermediate', 'advanced']);

export type ConceptDifficultyDto = z.infer<typeof conceptDifficultyDto>;
