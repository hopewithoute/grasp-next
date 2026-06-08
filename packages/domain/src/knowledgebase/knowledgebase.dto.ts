import { conceptDifficultyDto } from '../concepts';
import { RELATIONSHIP_TYPES } from '../constants';
import { normalizedSourceDto } from '../sources';
import { confidenceScore, requiredString, v } from '../validation';

export const sourceReferenceDto = v.object({
  blockId: requiredString,
  locationLabel: requiredString,
  quote: requiredString,
  sourceId: requiredString,
});

export const knowledgebaseRelationshipTypeDto = v.picklist(RELATIONSHIP_TYPES);

export const knowledgebaseConceptDto = v.object({
  confidence: confidenceScore,
  definition: requiredString,
  difficulty: conceptDifficultyDto,
  id: requiredString,
  name: requiredString,
  sourceRefs: v.pipe(v.array(sourceReferenceDto), v.minLength(1)),
});

export const knowledgebaseRelationshipDto = v.object({
  id: requiredString,
  rationale: v.optional(requiredString),
  relationshipType: knowledgebaseRelationshipTypeDto,
  sourceConceptId: requiredString,
  sourceRefs: v.pipe(v.array(sourceReferenceDto), v.minLength(1)),
  targetConceptId: requiredString,
});

export const knowledgebaseDto = v.object({
  concepts: v.pipe(v.array(knowledgebaseConceptDto), v.minLength(1)),
  overview: requiredString,
  relationships: v.optional(v.array(knowledgebaseRelationshipDto), []),
});

export const knowledgebaseGraphProjectionDto = v.object({
  edges: v.array(
    v.object({
      id: requiredString,
      relationshipId: requiredString,
      relationshipType: knowledgebaseRelationshipTypeDto,
      sourceNodeId: requiredString,
      targetNodeId: requiredString,
    })
  ),
  nodes: v.array(
    v.object({
      conceptId: requiredString,
      id: requiredString,
      label: requiredString,
    })
  ),
});

export const knowledgebaseArtifactContentDto = v.object({
  graphProjection: knowledgebaseGraphProjectionDto,
  knowledgebase: knowledgebaseDto,
  normalizedSource: normalizedSourceDto,
});

export type KnowledgebaseArtifactContentDto = v.InferOutput<typeof knowledgebaseArtifactContentDto>;
export type KnowledgebaseConceptDto = v.InferOutput<typeof knowledgebaseConceptDto>;
export type KnowledgebaseDto = v.InferOutput<typeof knowledgebaseDto>;
export type KnowledgebaseGraphProjectionDto = v.InferOutput<typeof knowledgebaseGraphProjectionDto>;
export type KnowledgebaseRelationshipDto = v.InferOutput<typeof knowledgebaseRelationshipDto>;
export type KnowledgebaseRelationshipTypeDto = v.InferOutput<
  typeof knowledgebaseRelationshipTypeDto
>;
export type SourceReferenceDto = v.InferOutput<typeof sourceReferenceDto>;
