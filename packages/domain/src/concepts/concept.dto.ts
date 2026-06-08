import { v } from '../validation';

export const CONCEPT_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export type ConceptDifficultyDto = (typeof CONCEPT_DIFFICULTIES)[number];

export const conceptDifficultyDto = v.picklist(CONCEPT_DIFFICULTIES);
