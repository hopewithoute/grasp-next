import { and, asc, eq, exists, ilike, isNotNull, or, sql } from 'drizzle-orm';
import type {
  KnowledgebaseQueryRepository,
} from '@grasp/domain';
import type { DbClient } from './client';
import {
  knowledgebases,
  sourcePassages,
  wikiConcepts,
  wikiConceptSourceRefs,
  wikiRelationships,
  wikiRelationshipSourceRefs,
} from './schema';
import {
  getConceptEvidence,
  getConceptEvidenceCounts,
  getMappedId,
  getRelationshipEvidenceCounts,
  toConceptDifficulty,
} from './knowledgebase-helpers';

export function createKnowledgebaseQueryMethods(db: DbClient): KnowledgebaseQueryRepository {
  return {
    async findConceptEvidence(input) {
      const rows = await db
        .select({
          id: wikiConceptSourceRefs.id,
          blockId: sourcePassages.blockId,
          excerpt: wikiConceptSourceRefs.quote,
          location: wikiConceptSourceRefs.locationLabel,
          sourceId: sourcePassages.sourceId,
        })
        .from(wikiConceptSourceRefs)
        .innerJoin(sourcePassages, eq(wikiConceptSourceRefs.sourcePassageId, sourcePassages.id))
        .innerJoin(wikiConcepts, eq(wikiConceptSourceRefs.conceptId, wikiConcepts.id))
        .innerJoin(knowledgebases, eq(wikiConcepts.knowledgebaseId, knowledgebases.id))
        .where(
          and(
            eq(knowledgebases.projectId, input.projectId),
            eq(wikiConcepts.conceptKey, input.conceptKey)
          )
        );
      return rows;
    },

    async findRelationshipEvidence(input) {
      const rows = await db
        .select({
          id: wikiRelationshipSourceRefs.id,
          blockId: sourcePassages.blockId,
          excerpt: wikiRelationshipSourceRefs.quote,
          location: wikiRelationshipSourceRefs.locationLabel,
          sourceId: sourcePassages.sourceId,
        })
        .from(wikiRelationshipSourceRefs)
        .innerJoin(
          sourcePassages,
          eq(wikiRelationshipSourceRefs.sourcePassageId, sourcePassages.id)
        )
        .innerJoin(
          wikiRelationships,
          eq(wikiRelationshipSourceRefs.relationshipId, wikiRelationships.id)
        )
        .innerJoin(knowledgebases, eq(wikiRelationships.knowledgebaseId, knowledgebases.id))
        .where(
          and(
            eq(knowledgebases.projectId, input.projectId),
            eq(wikiRelationships.relationshipKey, input.relationshipKey)
          )
        );
      return rows;
    },

    async findCurrentGraphByProject(projectId) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, projectId))
        .limit(1);

      if (!knowledgebase) {
        return null;
      }

      const [conceptRows, relationshipRows] = await Promise.all([
        db
          .select()
          .from(wikiConcepts)
          .where(eq(wikiConcepts.knowledgebaseId, knowledgebase.id))
          .orderBy(asc(wikiConcepts.createdAt)),
        db
          .select()
          .from(wikiRelationships)
          .where(eq(wikiRelationships.knowledgebaseId, knowledgebase.id))
          .orderBy(asc(wikiRelationships.createdAt)),
      ]);

      if (!conceptRows.length) {
        return null;
      }

      const evidenceCountsByConceptId = await getConceptEvidenceCounts(
        db,
        conceptRows.map((concept) => concept.id)
      );
      const evidenceCountsByRelationshipId = await getRelationshipEvidenceCounts(
        db,
        relationshipRows.map((relationship) => relationship.id)
      );
      const conceptKeyByRowId = new Map(
        conceptRows.map((concept) => [concept.id, concept.conceptKey])
      );

      return {
        concepts: conceptRows.map((concept) => ({
          confidence: concept.confidence.toFixed(2),
          definition: concept.definition,
          difficulty: toConceptDifficulty(concept.difficulty),
          id: concept.conceptKey,
          name: concept.name,
          evidenceCount: evidenceCountsByConceptId.get(concept.id) ?? 0,
        })),
        relationships: relationshipRows.map((relationship) => ({
          id: relationship.relationshipKey,
          metadata: relationship.metadata,
          relationshipType: relationship.relationshipType,
          sourceConceptId: getMappedId(conceptKeyByRowId, relationship.sourceConceptId, 'concept'),
          evidenceCount: evidenceCountsByRelationshipId.get(relationship.id) ?? 0,
          targetConceptId: getMappedId(conceptKeyByRowId, relationship.targetConceptId, 'concept'),
        })),
      };
    },

    async searchConceptsForIngestion(input) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, input.projectId))
        .limit(1);

      if (!knowledgebase) {
        return [];
      }

      const query = input.query.trim();
      if (!query) {
        return [];
      }

      const pattern = `%${query}%`;
      const distance = input.embedding
        ? sql<number>`${wikiConcepts.embedding} <=> ${vectorLiteral(input.embedding)}::vector`
        : sql<number | null>`null`;

      const rows = await db
        .select({
          id: wikiConcepts.id,
          conceptKey: wikiConcepts.conceptKey,
          confidence: wikiConcepts.confidence,
          definition: wikiConcepts.definition,
          distance,
          difficulty: wikiConcepts.difficulty,
          evidenceCount: sql<number>`count(${wikiConceptSourceRefs.id})::int`,
          name: wikiConcepts.name,
        })
        .from(wikiConcepts)
        .leftJoin(wikiConceptSourceRefs, eq(wikiConceptSourceRefs.conceptId, wikiConcepts.id))
        .where(
          and(
            eq(wikiConcepts.knowledgebaseId, knowledgebase.id),
            or(
              ilike(wikiConcepts.conceptKey, pattern),
              ilike(wikiConcepts.name, pattern),
              ilike(wikiConcepts.definition, pattern),
              input.embedding ? isNotNull(wikiConcepts.embedding) : sql`false`
            )
          )
        )
        .groupBy(
          wikiConcepts.id,
          wikiConcepts.conceptKey,
          wikiConcepts.confidence,
          wikiConcepts.definition,
          wikiConcepts.difficulty,
          wikiConcepts.name
        )
        .orderBy(input.embedding ? distance : asc(wikiConcepts.createdAt))
        .limit(input.limit ?? 10);

      console.log(`[searchConceptsForIngestion] projectId: ${input.projectId}, query: ${input.query}, hasEmbedding: ${!!input.embedding}, results: ${rows.length}`);
      if (rows.length === 0) {
        console.log(`[searchConceptsForIngestion] No results found! Knowledgebase ID: ${knowledgebase.id}`);
      }

      const evidenceByConceptId = await getConceptEvidence(
        db,
        rows.map((r) => r.id)
      );

      return rows.map((row) => ({
        ...row,
        distance: row.distance == null ? undefined : Number(row.distance),
        evidence: evidenceByConceptId.get(row.id) ?? [],
      }));
    },

    async getConceptContext(input) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, input.projectId))
        .limit(1);

      if (!knowledgebase) {
        return null;
      }

      const [concept] = await db
        .select()
        .from(wikiConcepts)
        .where(
          and(
            eq(wikiConcepts.knowledgebaseId, knowledgebase.id),
            eq(wikiConcepts.conceptKey, input.conceptKey)
          )
        )
        .limit(1);

      if (!concept) {
        return null;
      }

      const evidence = await db
        .select({
          blockId: sourcePassages.blockId,
          excerpt: wikiConceptSourceRefs.quote,
          location: wikiConceptSourceRefs.locationLabel,
          sourceId: sourcePassages.sourceId,
        })
        .from(wikiConceptSourceRefs)
        .innerJoin(sourcePassages, eq(wikiConceptSourceRefs.sourcePassageId, sourcePassages.id))
        .where(eq(wikiConceptSourceRefs.conceptId, concept.id));

      const outgoing = await db
        .select({
          conceptKey: wikiConcepts.conceptKey,
          name: wikiConcepts.name,
          relationshipType: wikiRelationships.relationshipType,
        })
        .from(wikiRelationships)
        .innerJoin(wikiConcepts, eq(wikiRelationships.targetConceptId, wikiConcepts.id))
        .where(eq(wikiRelationships.sourceConceptId, concept.id));

      const incoming = await db
        .select({
          conceptKey: wikiConcepts.conceptKey,
          name: wikiConcepts.name,
          relationshipType: wikiRelationships.relationshipType,
        })
        .from(wikiRelationships)
        .innerJoin(wikiConcepts, eq(wikiRelationships.sourceConceptId, wikiConcepts.id))
        .where(eq(wikiRelationships.targetConceptId, concept.id));

      return {
        concept: {
          conceptKey: concept.conceptKey,
          confidence: concept.confidence,
          definition: concept.definition,
          difficulty: concept.difficulty,
          evidenceCount: evidence.length,
          name: concept.name,
        },
        evidence,
        neighbors: [
          ...outgoing.map((neighbor) => ({ ...neighbor, direction: 'outgoing' as const })),
          ...incoming.map((neighbor) => ({ ...neighbor, direction: 'incoming' as const })),
        ],
      };
    },

    async searchConceptsWithPagination(input) {
      const { projectId, query, difficulty, limit, offset } = input;

      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, projectId))
        .limit(1);

      if (!knowledgebase) {
        return { concepts: [], totalCount: 0 };
      }

      const filterConditions = [eq(wikiConcepts.knowledgebaseId, knowledgebase.id)];

      if (difficulty && difficulty !== 'all') {
        filterConditions.push(eq(wikiConcepts.difficulty, difficulty));
      }

      if (query && query.trim() !== '') {
        const searchPattern = `%${query.trim()}%`;
        const searchOr = or(
          ilike(wikiConcepts.name, searchPattern),
          ilike(wikiConcepts.definition, searchPattern),
          exists(
            db
              .select({ id: wikiConceptSourceRefs.id })
              .from(wikiConceptSourceRefs)
              .where(
                and(
                  eq(wikiConceptSourceRefs.conceptId, wikiConcepts.id),
                  ilike(wikiConceptSourceRefs.quote, searchPattern)
                )
              )
          )
        );
        if (searchOr) {
          filterConditions.push(searchOr);
        }
      }

      const combinedWhere = and(...filterConditions);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(wikiConcepts)
        .where(combinedWhere);

      const conceptRows = await db
        .select()
        .from(wikiConcepts)
        .where(combinedWhere)
        .orderBy(asc(wikiConcepts.name))
        .limit(limit)
        .offset(offset);

      if (!conceptRows.length) {
        return { concepts: [], totalCount: Number(count) };
      }

      const evidenceCounts = await getConceptEvidenceCounts(
        db,
        conceptRows.map((c) => c.id)
      );

      return {
        concepts: conceptRows.map((concept) => ({
          confidence: concept.confidence.toFixed(2),
          definition: concept.definition,
          difficulty: toConceptDifficulty(concept.difficulty),
          id: concept.conceptKey,
          name: concept.name,
          evidenceCount: evidenceCounts.get(concept.id) ?? 0,
        })),
        totalCount: Number(count),
      };
    },
  };
}

function vectorLiteral(embedding: number[]) {
  return `[${embedding.join(',')}]`;
}
