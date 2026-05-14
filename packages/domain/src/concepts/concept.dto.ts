import { z } from "zod";

export const conceptDifficultyDto = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);

export const sourceEvidenceDto = z.object({
  excerpt: z.string().trim().min(1),
  location: z.string().trim().optional(),
});

export const extractedConceptDto = z.object({
  confidence: z.number().min(0).max(1),
  definition: z.string().trim().min(1),
  difficulty: conceptDifficultyDto,
  name: z.string().trim().min(1),
  sourceEvidence: z.array(sourceEvidenceDto).min(1),
});

export const extractedConceptRelationshipDto = z.object({
  relationshipType: z.literal("prerequisite").default("prerequisite"),
  sourceConceptName: z.string().trim().min(1),
  targetConceptName: z.string().trim().min(1),
});

export const extractedConceptGraphDto = z.object({
  concepts: z.array(extractedConceptDto).min(1),
  relationships: z.array(extractedConceptRelationshipDto).default([]),
});

export type ConceptDifficultyDto = z.infer<typeof conceptDifficultyDto>;
export type ExtractedConceptDto = z.infer<typeof extractedConceptDto>;
export type ExtractedConceptGraphDto = z.infer<typeof extractedConceptGraphDto>;
export type ExtractedConceptRelationshipDto = z.infer<
  typeof extractedConceptRelationshipDto
>;
export type SourceEvidenceDto = z.infer<typeof sourceEvidenceDto>;
