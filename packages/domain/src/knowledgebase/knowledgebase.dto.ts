import { z } from 'zod';
import { conceptDifficultyDto } from '../concepts';
import { normalizedSourceDto } from '../sources';

export const sourceReferenceDto = z.object({
  blockId: z.string().trim().min(1),
  locationLabel: z.string().trim().min(1),
  quote: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
});

export const knowledgebaseConceptDto = z.object({
  confidence: z.number().min(0).max(1),
  definition: z.string().trim().min(1),
  difficulty: conceptDifficultyDto,
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  sourceRefs: z.array(sourceReferenceDto).min(1),
});

export const knowledgebaseRelationshipDto = z.object({
  id: z.string().trim().min(1),
  rationale: z.string().trim().min(1).optional(),
  relationshipType: z.literal('prerequisite'),
  sourceConceptId: z.string().trim().min(1),
  sourceRefs: z.array(sourceReferenceDto).min(1),
  targetConceptId: z.string().trim().min(1),
});

export const knowledgebaseDto = z.object({
  concepts: z.array(knowledgebaseConceptDto).min(1),
  overview: z.string().trim().min(1),
  relationships: z.array(knowledgebaseRelationshipDto).default([]),
});

export const knowledgebaseGraphProjectionDto = z.object({
  edges: z.array(
    z.object({
      id: z.string().trim().min(1),
      relationshipId: z.string().trim().min(1),
      relationshipType: z.literal('prerequisite'),
      sourceNodeId: z.string().trim().min(1),
      targetNodeId: z.string().trim().min(1),
    })
  ),
  nodes: z.array(
    z.object({
      conceptId: z.string().trim().min(1),
      id: z.string().trim().min(1),
      label: z.string().trim().min(1),
    })
  ),
});

export const knowledgebaseArtifactContentDto = z.object({
  graphProjection: knowledgebaseGraphProjectionDto,
  knowledgebase: knowledgebaseDto,
  normalizedSource: normalizedSourceDto,
});

export type KnowledgebaseArtifactContentDto = z.infer<typeof knowledgebaseArtifactContentDto>;
export type KnowledgebaseConceptDto = z.infer<typeof knowledgebaseConceptDto>;
export type KnowledgebaseDto = z.infer<typeof knowledgebaseDto>;
export type KnowledgebaseGraphProjectionDto = z.infer<typeof knowledgebaseGraphProjectionDto>;
export type KnowledgebaseRelationshipDto = z.infer<typeof knowledgebaseRelationshipDto>;
export type SourceReferenceDto = z.infer<typeof sourceReferenceDto>;
