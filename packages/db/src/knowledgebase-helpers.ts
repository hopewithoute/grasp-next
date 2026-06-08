import { eq, or, sql } from 'drizzle-orm';
import type { KnowledgebaseArtifactContentDto } from '@grasp/domain';
import type { DbClient } from './client';
import {
  knowledgebases,
  sourcePassages,
  wikiConcepts,
  wikiConceptSourceRefs,
  wikiRelationships,
  wikiRelationshipSourceRefs,
} from './schema';

export function toConceptDifficulty(value: string) {
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced') {
    return value;
  }
  return 'beginner';
}

export function getMappedId(ids: Map<string, string>, key: string, type: string) {
  const id = ids.get(key);
  if (!id) {
    throw new Error(`knowledgebase_${type}_row_missing:${key}`);
  }
  return id;
}

export function sourceRefKey(sourceId: string, blockId: string) {
  return `${sourceId}:${blockId}`;
}

export function getSourcePassageId(
  passageIdByRef: Map<string, string>,
  ref: { blockId: string; sourceId: string }
) {
  return getMappedId(passageIdByRef, sourceRefKey(ref.sourceId, ref.blockId), 'source_passage');
}

export function vectorLiteral(embedding: number[]) {
  return `[${embedding.join(',')}]`;
}

export async function getConceptEvidenceCounts(db: DbClient, conceptIds: string[]) {
  const countsByConceptId = new Map<string, number>();
  if (conceptIds.length === 0) return countsByConceptId;

  const rows = await db
    .select({
      conceptId: wikiConceptSourceRefs.conceptId,
      count: sql<number>`count(*)`,
    })
    .from(wikiConceptSourceRefs)
    .where(or(...conceptIds.map((id) => eq(wikiConceptSourceRefs.conceptId, id))))
    .groupBy(wikiConceptSourceRefs.conceptId);

  for (const row of rows) {
    countsByConceptId.set(row.conceptId, Number(row.count));
  }
  return countsByConceptId;
}

export async function getRelationshipEvidenceCounts(db: DbClient, relationshipIds: string[]) {
  const countsByRelationshipId = new Map<string, number>();
  if (relationshipIds.length === 0) return countsByRelationshipId;

  const rows = await db
    .select({
      relationshipId: wikiRelationshipSourceRefs.relationshipId,
      count: sql<number>`count(*)`,
    })
    .from(wikiRelationshipSourceRefs)
    .where(or(...relationshipIds.map((id) => eq(wikiRelationshipSourceRefs.relationshipId, id))))
    .groupBy(wikiRelationshipSourceRefs.relationshipId);

  for (const row of rows) {
    countsByRelationshipId.set(row.relationshipId, Number(row.count));
  }
  return countsByRelationshipId;
}

export async function getConceptEvidence(db: DbClient, conceptIds: string[]) {
  const evidenceByConceptId = new Map<string, unknown[]>();

  for (const conceptId of conceptIds) {
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
      .where(eq(wikiConceptSourceRefs.conceptId, conceptId));

    evidenceByConceptId.set(conceptId, rows);
  }
  return evidenceByConceptId;
}

export function relationshipMetadata(relationship: { evidenceQuality?: unknown }) {
  return relationship.evidenceQuality ? { evidenceQuality: relationship.evidenceQuality } : null;
}

export async function findOrCreateKnowledgebase(
  tx: Parameters<Parameters<DbClient['transaction']>[0]>[0],
  projectId: string
) {
  const [existing] = await tx
    .select()
    .from(knowledgebases)
    .where(eq(knowledgebases.projectId, projectId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [knowledgebase] = await tx
    .insert(knowledgebases)
    .values({ projectId })
    .onConflictDoUpdate({
      set: { updatedAt: new Date() },
      target: [knowledgebases.projectId],
    })
    .returning();

  return knowledgebase;
}

export async function upsertSourcePassages(
  tx: Parameters<Parameters<DbClient['transaction']>[0]>[0],
  projectId: string,
  content: KnowledgebaseArtifactContentDto
) {
  for (const block of content.normalizedSource.blocks) {
    if (!block.sourceId) {
      throw new Error(`knowledgebase_source_passage_missing_source:${block.id}`);
    }

    await tx
      .insert(sourcePassages)
      .values({
        blockId: block.id,
        kind: block.kind,
        location: block.location,
        metadata: block.metadata ?? null,
        order: block.order,
        projectId,
        sourceId: block.sourceId,
        text: block.text,
        embedding: null,
      })
      .onConflictDoUpdate({
        set: {
          embedding: null,
          kind: block.kind,
          location: block.location,
          metadata: block.metadata ?? null,
          order: block.order,
          text: block.text,
          updatedAt: new Date(),
        },
        target: [sourcePassages.sourceId, sourcePassages.blockId],
      });
  }
}

export async function insertWikiProjection(
  tx: Parameters<Parameters<DbClient['transaction']>[0]>[0],
  projectId: string,
  knowledgebaseId: string,
  knowledgebaseVersionId: string,
  content: KnowledgebaseArtifactContentDto
) {
  const passages = await tx
    .select()
    .from(sourcePassages)
    .where(eq(sourcePassages.projectId, projectId));
  const passageIdByRef = new Map(
    passages.map((passage) => [sourceRefKey(passage.sourceId, passage.blockId), passage.id])
  );

  const conceptIdByKey = new Map<string, string>();

  for (const concept of content.knowledgebase.concepts) {
    const [insertedConcept] = await tx
      .insert(wikiConcepts)
      .values({
        conceptKey: concept.id,
        confidence: concept.confidence,
        definition: concept.definition,
        difficulty: concept.difficulty,
        knowledgebaseId,
        knowledgebaseVersionId,
        metadata: null,
        name: concept.name,
      })
      .returning();

    conceptIdByKey.set(concept.id, insertedConcept.id);

    await tx.insert(wikiConceptSourceRefs).values(
      concept.sourceRefs.map((ref) => ({
        conceptId: insertedConcept.id,
        locationLabel: ref.locationLabel,
        quote: ref.quote,
        sourcePassageId: getSourcePassageId(passageIdByRef, ref),
      }))
    );
  }

  for (const relationship of content.knowledgebase.relationships) {
    const [insertedRelationship] = await tx
      .insert(wikiRelationships)
      .values({
        knowledgebaseId,
        knowledgebaseVersionId,
        metadata: null,
        rationale: relationship.rationale ?? null,
        relationshipKey: relationship.id,
        relationshipType: relationship.relationshipType,
        sourceConceptId: getMappedId(conceptIdByKey, relationship.sourceConceptId, 'concept'),
        targetConceptId: getMappedId(conceptIdByKey, relationship.targetConceptId, 'concept'),
      })
      .returning();

    await tx.insert(wikiRelationshipSourceRefs).values(
      relationship.sourceRefs.map((ref) => ({
        locationLabel: ref.locationLabel,
        quote: ref.quote,
        relationshipId: insertedRelationship.id,
        sourcePassageId: getSourcePassageId(passageIdByRef, ref),
      }))
    );
  }
}
