import type { NormalizedSourceDto } from '../sources';
import {
  type KnowledgebaseArtifactContentDto,
  type KnowledgebaseDto,
  type KnowledgebaseGraphProjectionDto,
} from './knowledgebase.dto';

export function buildKnowledgebaseArtifactContent(input: {
  knowledgebase: KnowledgebaseDto;
  normalizedSource: NormalizedSourceDto;
}): KnowledgebaseArtifactContentDto {
  const graphProjection = projectKnowledgebaseGraph(input.knowledgebase);

  return {
    graphProjection,
    knowledgebase: input.knowledgebase,
    normalizedSource: input.normalizedSource,
  };
}

export function projectKnowledgebaseGraph(
  knowledgebase: KnowledgebaseDto
): KnowledgebaseGraphProjectionDto {
  return {
    edges: knowledgebase.relationships.map((relationship) => ({
      id: `edge:${relationship.id}`,
      relationshipId: relationship.id,
      relationshipType: relationship.relationshipType,
      sourceNodeId: `node:${relationship.sourceConceptId}`,
      targetNodeId: `node:${relationship.targetConceptId}`,
    })),
    nodes: knowledgebase.concepts.map((concept) => ({
      conceptId: concept.id,
      id: `node:${concept.id}`,
      label: concept.name,
    })),
  };
}
