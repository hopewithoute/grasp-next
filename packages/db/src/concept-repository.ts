import { eq } from 'drizzle-orm';
import type { DbClient } from './client';
import { conceptRelationships, concepts } from './schema';

export type ConceptRepository = ReturnType<typeof createConceptRepository>;

export type ReplaceConceptsInput = {
  concepts: Array<{
    confidence: string;
    definition: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    name: string;
    sourceEvidence: unknown;
  }>;
  relationships: Array<{
    relationshipType: 'prerequisite';
    sourceConceptName: string;
    targetConceptName: string;
  }>;
};

export function createConceptRepository(db: DbClient) {
  return {
    async listByProject(projectId: string) {
      const [conceptRows, relationshipRows] = await Promise.all([
        db.select().from(concepts).where(eq(concepts.projectId, projectId)),
        db.select().from(conceptRelationships).where(eq(conceptRelationships.projectId, projectId)),
      ]);

      return {
        concepts: conceptRows,
        relationships: relationshipRows,
      };
    },

    async replaceForProject(projectId: string, input: ReplaceConceptsInput) {
      return db.transaction(async (tx) => {
        await tx.delete(conceptRelationships).where(eq(conceptRelationships.projectId, projectId));
        await tx.delete(concepts).where(eq(concepts.projectId, projectId));

        const insertedConcepts = input.concepts.length
          ? await tx
              .insert(concepts)
              .values(
                input.concepts.map((concept) => ({
                  ...concept,
                  projectId,
                }))
              )
              .returning()
          : [];

        const conceptIdByName = new Map(
          insertedConcepts.map((concept) => [normalizeConceptName(concept.name), concept.id])
        );

        const insertedRelationships = input.relationships.length
          ? await tx
              .insert(conceptRelationships)
              .values(
                input.relationships.map((relationship) => ({
                  projectId,
                  relationshipType: relationship.relationshipType,
                  sourceConceptId: getConceptIdByName(
                    conceptIdByName,
                    relationship.sourceConceptName
                  ),
                  targetConceptId: getConceptIdByName(
                    conceptIdByName,
                    relationship.targetConceptName
                  ),
                }))
              )
              .returning()
          : [];

        return {
          concepts: insertedConcepts,
          relationships: insertedRelationships,
        };
      });
    },
  };
}

function normalizeConceptName(name: string) {
  return name.trim().toLowerCase();
}

function getConceptIdByName(conceptIdByName: Map<string, string>, name: string) {
  const conceptId = conceptIdByName.get(normalizeConceptName(name));

  if (!conceptId) {
    throw new Error(`Concept relationship references unknown concept: ${name}`);
  }

  return conceptId;
}
