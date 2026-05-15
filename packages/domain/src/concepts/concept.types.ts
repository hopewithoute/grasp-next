import type { ConceptDifficultyDto } from './concept.dto';

export type ConceptRecord = {
  id: string;
  projectId: string;
  name: string;
  definition: string;
  difficulty: ConceptDifficultyDto;
  confidence: string;
  sourceEvidence: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type ConceptRelationshipRecord = {
  id: string;
  projectId: string;
  sourceConceptId: string;
  targetConceptId: string;
  relationshipType: string;
  createdAt: Date;
};

export type ConceptRepository = {
  listByProject(projectId: string): Promise<{
    concepts: ConceptRecord[];
    relationships: ConceptRelationshipRecord[];
  }>;
  replaceForProject(
    projectId: string,
    input: {
      concepts: Array<{
        confidence: string;
        definition: string;
        difficulty: ConceptDifficultyDto;
        name: string;
        sourceEvidence: unknown;
      }>;
      relationships: Array<{
        relationshipType: 'prerequisite';
        sourceConceptName: string;
        targetConceptName: string;
      }>;
    }
  ): Promise<{
    concepts: ConceptRecord[];
    relationships: ConceptRelationshipRecord[];
  }>;
};
