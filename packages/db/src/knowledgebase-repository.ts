import { and, asc, eq, exists, ilike, max, or, sql } from 'drizzle-orm';
import type { KnowledgebaseArtifactContentDto, KnowledgebaseRepository } from '@grasp/domain';
import { KNOWLEDGEBASE_VERSION_STATUS } from '@grasp/domain';
import type { DbClient } from './client';
import {
  knowledgebases,
  knowledgebaseVersions,
  projectSources,
  sourcePassages,
  wikiConcepts,
  wikiConceptSourceRefs,
  wikiRelationships,
  wikiRelationshipSourceRefs,
} from './schema';

export type DbKnowledgebaseRepository = ReturnType<typeof createKnowledgebaseRepository>;

export function createKnowledgebaseRepository(db: DbClient): KnowledgebaseRepository {
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
        .innerJoin(sourcePassages, eq(wikiRelationshipSourceRefs.sourcePassageId, sourcePassages.id))
        .innerJoin(wikiRelationships, eq(wikiRelationshipSourceRefs.relationshipId, wikiRelationships.id))
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

      const evidenceCountsByConceptId = await getConceptEvidenceCounts(db, conceptRows.map((concept) => concept.id));
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
              input.embedding ? sql`${wikiConcepts.embedding} is not null` : sql`false`
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

      const evidenceByConceptId = await getConceptEvidence(db, rows.map(r => r.id));

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

    async mergeIngestionOutput(input) {
      return db.transaction(async (tx) => {
        const knowledgebase = await findOrCreateKnowledgebase(tx, input.projectId);

        // Cleanup: remove old source refs from this source, then orphan concepts
        const passagesForSource = await tx
          .select({ id: sourcePassages.id })
          .from(sourcePassages)
          .where(eq(sourcePassages.sourceId, input.sourceId));
        const passageIds = passagesForSource.map((p) => p.id);

        if (passageIds.length > 0) {
          // Delete concept source refs pointing to this source's passages
          for (const passageId of passageIds) {
            await tx
              .delete(wikiConceptSourceRefs)
              .where(eq(wikiConceptSourceRefs.sourcePassageId, passageId));
            await tx
              .delete(wikiRelationshipSourceRefs)
              .where(eq(wikiRelationshipSourceRefs.sourcePassageId, passageId));
          }

          // Delete orphan concepts (no remaining source refs)
          const conceptsInKb = await tx
            .select({ id: wikiConcepts.id })
            .from(wikiConcepts)
            .where(eq(wikiConcepts.knowledgebaseId, knowledgebase.id));

          for (const concept of conceptsInKb) {
            const [hasRefs] = await tx
              .select({ id: wikiConceptSourceRefs.id })
              .from(wikiConceptSourceRefs)
              .where(eq(wikiConceptSourceRefs.conceptId, concept.id))
              .limit(1);

            if (!hasRefs) {
              await tx.delete(wikiConcepts).where(eq(wikiConcepts.id, concept.id));
            }
          }

          // Delete orphan relationships (source or target concept was deleted)
          const remainingConceptIds = new Set(
            (await tx.select({ id: wikiConcepts.id }).from(wikiConcepts).where(eq(wikiConcepts.knowledgebaseId, knowledgebase.id)))
              .map((c) => c.id)
          );
          const relationships = await tx
            .select({ id: wikiRelationships.id, sourceConceptId: wikiRelationships.sourceConceptId, targetConceptId: wikiRelationships.targetConceptId })
            .from(wikiRelationships)
            .where(eq(wikiRelationships.knowledgebaseId, knowledgebase.id));

          for (const rel of relationships) {
            if (!remainingConceptIds.has(rel.sourceConceptId) || !remainingConceptIds.has(rel.targetConceptId)) {
              await tx.delete(wikiRelationships).where(eq(wikiRelationships.id, rel.id));
            }
          }
        }

        // Resolve concept IDs (existing + newly upserted concepts)
        const existingConcepts = await tx
          .select({ conceptKey: wikiConcepts.conceptKey, id: wikiConcepts.id })
          .from(wikiConcepts)
          .where(eq(wikiConcepts.knowledgebaseId, knowledgebase.id));
        const conceptIdByKey = new Map(
          existingConcepts.map((concept) => [concept.conceptKey, concept.id])
        );

        for (const concept of input.output.concepts) {
          const effectiveKey = concept.mergesWith ?? concept.conceptKey;

          const [row] = await tx
            .insert(wikiConcepts)
            .values({
              conceptKey: effectiveKey,
              confidence: concept.confidence,
              definition: concept.definition,
              difficulty: concept.difficulty,
              embedding: input.conceptEmbeddingsByKey?.[effectiveKey] ?? null,
              knowledgebaseId: knowledgebase.id,
              metadata: null,
              name: concept.name,
            })
            .onConflictDoUpdate({
              set: {
                confidence: concept.confidence,
                definition: concept.definition,
                difficulty: concept.difficulty,
                embedding: input.conceptEmbeddingsByKey?.[effectiveKey] ?? null,
                name: concept.name,
                updatedAt: new Date(),
              },
              target: [wikiConcepts.knowledgebaseId, wikiConcepts.conceptKey],
            })
            .returning({ id: wikiConcepts.id });

          conceptIdByKey.set(effectiveKey, row.id);

          // Append source refs
          const passages = await tx
            .select({ id: sourcePassages.id, blockId: sourcePassages.blockId })
            .from(sourcePassages)
            .where(eq(sourcePassages.sourceId, input.sourceId));
          const passageIdByBlockId = new Map(passages.map((p) => [p.blockId, p.id]));

          for (const ref of concept.sourceRefs) {
            const fullBlockId = `${input.sourceId}:${ref.blockId}`;
            const passageId = passageIdByBlockId.get(fullBlockId) ?? passageIdByBlockId.get(ref.blockId);
            if (!passageId) continue;

            await tx
              .insert(wikiConceptSourceRefs)
              .values({
                conceptId: row.id,
                locationLabel: ref.locationLabel,
                quote: ref.quote,
                sourcePassageId: passageId,
              })
              .onConflictDoNothing();
          }
        }

        // Upsert relationships
        for (const rel of input.output.relationships) {
          const sourceConceptId = conceptIdByKey.get(rel.sourceConceptKey);
          const targetConceptId = conceptIdByKey.get(rel.targetConceptKey);
          if (!sourceConceptId || !targetConceptId) continue;

          const relationshipKey = `${rel.sourceConceptKey}:${rel.targetConceptKey}:${rel.relationshipType}`;

          const [relRow] = await tx
            .insert(wikiRelationships)
            .values({
              knowledgebaseId: knowledgebase.id,
              metadata: relationshipMetadata(rel),
              rationale: rel.rationale ?? null,
              relationshipKey,
              relationshipType: rel.relationshipType,
              sourceConceptId,
              targetConceptId,
            })
            .onConflictDoUpdate({
              set: {
                metadata: relationshipMetadata(rel),
                rationale: rel.rationale ?? null,
                updatedAt: new Date(),
              },
              target: [wikiRelationships.knowledgebaseId, wikiRelationships.relationshipKey],
            })
            .returning({ id: wikiRelationships.id });

          // Append relationship source refs
          const passages = await tx
            .select({ id: sourcePassages.id, blockId: sourcePassages.blockId })
            .from(sourcePassages)
            .where(eq(sourcePassages.sourceId, input.sourceId));
          const passageIdByBlockId = new Map(passages.map((p) => [p.blockId, p.id]));

          for (const ref of rel.sourceRefs) {
            const fullBlockId = `${input.sourceId}:${ref.blockId}`;
            const passageId = passageIdByBlockId.get(fullBlockId) ?? passageIdByBlockId.get(ref.blockId);
            if (!passageId) continue;

            await tx
              .insert(wikiRelationshipSourceRefs)
              .values({
                locationLabel: ref.locationLabel,
                quote: ref.quote,
                relationshipId: relRow.id,
                sourcePassageId: passageId,
              })
              .onConflictDoNothing();
          }
        }

        // Snapshot current state as new version
        const allConcepts = await tx
          .select()
          .from(wikiConcepts)
          .where(eq(wikiConcepts.knowledgebaseId, knowledgebase.id));
        const allRelationships = await tx
          .select()
          .from(wikiRelationships)
          .where(eq(wikiRelationships.knowledgebaseId, knowledgebase.id));

        const snapshot = {
          concepts: allConcepts.map((c) => ({
            conceptKey: c.conceptKey,
            confidence: c.confidence,
            definition: c.definition,
            difficulty: c.difficulty,
            name: c.name,
          })),
          relationships: allRelationships.map((r) => ({
            rationale: r.rationale,
            relationshipKey: r.relationshipKey,
            relationshipType: r.relationshipType,
          })),
          trigger: { sourceId: input.sourceId },
        };

        const [{ nextVersionNumber }] = await tx
          .select({ nextVersionNumber: max(knowledgebaseVersions.versionNumber) })
          .from(knowledgebaseVersions)
          .where(eq(knowledgebaseVersions.knowledgebaseId, knowledgebase.id));

        const [version] = await tx
          .insert(knowledgebaseVersions)
          .values({
            knowledgebaseId: knowledgebase.id,
            snapshot,
            status: KNOWLEDGEBASE_VERSION_STATUS.GENERATED,
            versionNumber: (nextVersionNumber ?? 0) + 1,
          })
          .returning();

        await tx
          .update(knowledgebases)
          .set({ currentVersionId: version.id, updatedAt: new Date() })
          .where(eq(knowledgebases.id, knowledgebase.id));

        return {
          createdAt: version.createdAt,
          id: version.id,
          knowledgebaseId: version.knowledgebaseId,
          versionNumber: version.versionNumber,
        };
      });
    },

    async cleanupDeletedSource(input) {
      await db.transaction(async (tx) => {
        // Find passages for this source
        const passages = await tx
          .select({ id: sourcePassages.id })
          .from(sourcePassages)
          .where(eq(sourcePassages.sourceId, input.sourceId));
        const passageIds = passages.map((p) => p.id);

        if (!passageIds.length) return;

        // Delete source refs pointing to these passages
        for (const passageId of passageIds) {
          await tx.delete(wikiConceptSourceRefs).where(eq(wikiConceptSourceRefs.sourcePassageId, passageId));
          await tx.delete(wikiRelationshipSourceRefs).where(eq(wikiRelationshipSourceRefs.sourcePassageId, passageId));
        }

        // Find knowledgebase for this project
        const [knowledgebase] = await tx
          .select()
          .from(knowledgebases)
          .where(eq(knowledgebases.projectId, input.projectId))
          .limit(1);

        if (!knowledgebase) return;

        // Delete orphan concepts (no remaining source refs)
        const concepts = await tx
          .select({ id: wikiConcepts.id })
          .from(wikiConcepts)
          .where(eq(wikiConcepts.knowledgebaseId, knowledgebase.id));

        for (const concept of concepts) {
          const [hasRefs] = await tx
            .select({ id: wikiConceptSourceRefs.id })
            .from(wikiConceptSourceRefs)
            .where(eq(wikiConceptSourceRefs.conceptId, concept.id))
            .limit(1);

          if (!hasRefs) {
            await tx.delete(wikiConcepts).where(eq(wikiConcepts.id, concept.id));
          }
        }

        // Delete orphan relationships (source/target concept deleted via CASCADE)
        // CASCADE handles this automatically since wikiRelationships references wikiConcepts

        // Delete the passages themselves
        for (const passageId of passageIds) {
          await tx.delete(sourcePassages).where(eq(sourcePassages.id, passageId));
        }
      });
    },

    async upsertSourcePassages(input) {
      for (const block of input.blocks) {
        await db
          .insert(sourcePassages)
          .values({
            blockId: `${input.sourceId}:${block.id}`,
            kind: block.kind,
            location: block.location,
            metadata: block.metadata ?? null,
            order: block.order,
            projectId: input.projectId,
            sourceId: input.sourceId,
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

    async replaceVersionFromContent(input) {
      return db.transaction(async (tx) => {
        const knowledgebase = await findOrCreateKnowledgebase(tx, input.projectId);

        await upsertSourcePassages(tx, input.projectId, input.content);

        const [{ nextVersionNumber }] = await tx
          .select({
            nextVersionNumber: max(knowledgebaseVersions.versionNumber),
          })
          .from(knowledgebaseVersions)
          .where(eq(knowledgebaseVersions.knowledgebaseId, knowledgebase.id));

        const [version] = await tx
          .insert(knowledgebaseVersions)
          .values({
            knowledgebaseId: knowledgebase.id,
            snapshot: input.content,
            status: KNOWLEDGEBASE_VERSION_STATUS.GENERATED,
            versionNumber: (nextVersionNumber ?? 0) + 1,
          })
          .returning();

        await tx
          .update(knowledgebases)
          .set({
            currentVersionId: version.id,
            updatedAt: new Date(),
          })
          .where(eq(knowledgebases.id, knowledgebase.id));

        await insertWikiProjection(tx, input.projectId, knowledgebase.id, version.id, input.content);

        return {
          createdAt: version.createdAt,
          id: version.id,
          knowledgebaseId: version.knowledgebaseId,
          versionNumber: version.versionNumber,
        };
      });
    },

    async addConcept(input) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, input.projectId))
        .limit(1);

      if (!knowledgebase) {
        throw new Error(`Knowledgebase not found for project ${input.projectId}`);
      }

      await db.insert(wikiConcepts).values({
        knowledgebaseId: knowledgebase.id,
        conceptKey: input.conceptKey,
        name: input.name,
        definition: input.definition,
        difficulty: input.difficulty,
        confidence: input.confidence,
        metadata: input.metadata,
      }).onConflictDoUpdate({
        target: [wikiConcepts.knowledgebaseId, wikiConcepts.conceptKey],
        set: {
          name: input.name,
          definition: input.definition,
          difficulty: input.difficulty,
          confidence: input.confidence,
          metadata: input.metadata,
          updatedAt: new Date(),
        }
      });
    },

    async updateConcept(input) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, input.projectId))
        .limit(1);

      if (!knowledgebase) {
        throw new Error(`Knowledgebase not found for project ${input.projectId}`);
      }

      const updates: Partial<typeof wikiConcepts.$inferInsert> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.definition !== undefined) updates.definition = input.definition;
      if (input.difficulty !== undefined) updates.difficulty = input.difficulty;
      if (input.confidence !== undefined) updates.confidence = input.confidence;
      if (input.metadata !== undefined) updates.metadata = input.metadata;
      
      updates.updatedAt = new Date();

      await db
        .update(wikiConcepts)
        .set(updates)
        .where(
          and(
            eq(wikiConcepts.knowledgebaseId, knowledgebase.id),
            eq(wikiConcepts.conceptKey, input.conceptKey)
          )
        );
    },

    async deleteConcept(input) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, input.projectId))
        .limit(1);

      if (!knowledgebase) return;

      await db
        .delete(wikiConcepts)
        .where(
          and(
            eq(wikiConcepts.knowledgebaseId, knowledgebase.id),
            eq(wikiConcepts.conceptKey, input.conceptKey)
          )
        );
    },

    async addRelationship(input) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, input.projectId))
        .limit(1);

      if (!knowledgebase) {
        throw new Error(`Knowledgebase not found for project ${input.projectId}`);
      }

      const [sourceConcept] = await db
        .select()
        .from(wikiConcepts)
        .where(
          and(
            eq(wikiConcepts.knowledgebaseId, knowledgebase.id),
            eq(wikiConcepts.conceptKey, input.sourceConceptKey)
          )
        )
        .limit(1);

      const [targetConcept] = await db
        .select()
        .from(wikiConcepts)
        .where(
          and(
            eq(wikiConcepts.knowledgebaseId, knowledgebase.id),
            eq(wikiConcepts.conceptKey, input.targetConceptKey)
          )
        )
        .limit(1);

      if (!sourceConcept || !targetConcept) {
        throw new Error(
          `Cannot add relationship: source (${input.sourceConceptKey}) or target (${input.targetConceptKey}) concept not found.`
        );
      }

      await db.insert(wikiRelationships).values({
        knowledgebaseId: knowledgebase.id,
        relationshipKey: input.relationshipKey,
        sourceConceptId: sourceConcept.id,
        targetConceptId: targetConcept.id,
        relationshipType: input.relationshipType,
        rationale: input.rationale,
        metadata: input.metadata,
      }).onConflictDoUpdate({
        target: [wikiRelationships.knowledgebaseId, wikiRelationships.relationshipKey],
        set: {
          relationshipType: input.relationshipType,
          rationale: input.rationale,
          metadata: input.metadata,
          updatedAt: new Date(),
        }
      });
    },

    async deleteRelationship(input) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, input.projectId))
        .limit(1);

      if (!knowledgebase) return;

      await db
        .delete(wikiRelationships)
        .where(
          and(
            eq(wikiRelationships.knowledgebaseId, knowledgebase.id),
            eq(wikiRelationships.relationshipKey, input.relationshipKey)
          )
        );
    },

    async updateConceptEvidence(input) {
      if (!input.quote && !input.locationLabel) return;
      
      const updates: any = {};
      if (input.quote !== undefined) updates.quote = input.quote;
      if (input.locationLabel !== undefined) updates.locationLabel = input.locationLabel;
      
      await db
        .update(wikiConceptSourceRefs)
        .set(updates)
        .where(
          and(
            eq(wikiConceptSourceRefs.id, input.evidenceId),
            exists(
              db.select()
                .from(wikiConcepts)
                .innerJoin(knowledgebases, eq(wikiConcepts.knowledgebaseId, knowledgebases.id))
                .where(
                  and(
                    eq(wikiConcepts.id, wikiConceptSourceRefs.conceptId),
                    eq(knowledgebases.projectId, input.projectId)
                  )
                )
            )
          )
        );
    },

    async deleteConceptEvidence(input) {
      await db
        .delete(wikiConceptSourceRefs)
        .where(
          and(
            eq(wikiConceptSourceRefs.id, input.evidenceId),
            exists(
              db.select()
                .from(wikiConcepts)
                .innerJoin(knowledgebases, eq(wikiConcepts.knowledgebaseId, knowledgebases.id))
                .where(
                  and(
                    eq(wikiConcepts.id, wikiConceptSourceRefs.conceptId),
                    eq(knowledgebases.projectId, input.projectId)
                  )
                )
            )
          )
        );
    },
    async addConceptEvidence(input) {
      return db.transaction(async (tx) => {
        const [knowledgebase] = await tx
          .select()
          .from(knowledgebases)
          .where(eq(knowledgebases.projectId, input.projectId))
          .limit(1);

        if (!knowledgebase) {
          throw new Error(`Knowledgebase not found for project ${input.projectId}`);
        }

        const [concept] = await tx
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
          throw new Error(`Cannot add evidence: concept ${input.conceptKey} not found.`);
        }

        const sourceTitle = input.sourceType === 'text' 
            ? 'User Chat Correction' 
            : input.title;
        
        const fileRef = input.url ?? null;
        
        let source: typeof projectSources.$inferSelect | undefined;
        if (fileRef) {
          [source] = await tx
            .select()
            .from(projectSources)
            .where(
              and(
                eq(projectSources.projectId, input.projectId),
                eq(projectSources.fileRef, fileRef)
              )
            )
            .limit(1);
        }

        if (!source) {
          const type = input.sourceType === 'web' ? 'web' : 'text';
          const [newSource] = await tx
            .insert(projectSources)
            .values({
              projectId: input.projectId,
              type,
              title: sourceTitle,
              content: input.sourceType === 'text' ? input.quote : null,
              fileRef,
            })
            .returning();
          source = newSource;
        }

        const blockId = `virtual-${crypto.randomUUID()}`;
        const [passage] = await tx
          .insert(sourcePassages)
          .values({
            projectId: input.projectId,
            sourceId: source.id,
            blockId,
            kind: 'paragraph',
            text: input.quote,
            location: { label: input.locationLabel },
            order: 0,
          })
          .returning();

        await tx.insert(wikiConceptSourceRefs).values({
          conceptId: concept.id,
          sourcePassageId: passage.id,
          quote: input.quote,
          locationLabel: input.locationLabel,
        });
      });
    },

    async createSnapshot(input) {
      return db.transaction(async (tx) => {
        const [knowledgebase] = await tx
          .select()
          .from(knowledgebases)
          .where(eq(knowledgebases.projectId, input.projectId))
          .limit(1);

        if (!knowledgebase) return null;

        const allConcepts = await tx
          .select()
          .from(wikiConcepts)
          .where(eq(wikiConcepts.knowledgebaseId, knowledgebase.id));
        
        const allRelationships = await tx
          .select()
          .from(wikiRelationships)
          .where(eq(wikiRelationships.knowledgebaseId, knowledgebase.id));

        const snapshot = {
          concepts: allConcepts.map((c) => ({
            conceptKey: c.conceptKey,
            confidence: c.confidence,
            definition: c.definition,
            difficulty: c.difficulty,
            name: c.name,
          })),
          relationships: allRelationships.map((r) => ({
            rationale: r.rationale,
            relationshipKey: r.relationshipKey,
            relationshipType: r.relationshipType,
          })),
          trigger: { event: input.trigger },
        };

        const [{ nextVersionNumber }] = await tx
          .select({ nextVersionNumber: max(knowledgebaseVersions.versionNumber) })
          .from(knowledgebaseVersions)
          .where(eq(knowledgebaseVersions.knowledgebaseId, knowledgebase.id));

        const [version] = await tx
          .insert(knowledgebaseVersions)
          .values({
            knowledgebaseId: knowledgebase.id,
            snapshot,
            status: KNOWLEDGEBASE_VERSION_STATUS.GENERATED,
            versionNumber: (nextVersionNumber ?? 0) + 1,
          })
          .returning();

        await tx
          .update(knowledgebases)
          .set({ currentVersionId: version.id, updatedAt: new Date() })
          .where(eq(knowledgebases.id, knowledgebase.id));

        return {
          createdAt: version.createdAt,
          id: version.id,
          knowledgebaseId: version.knowledgebaseId,
          versionNumber: version.versionNumber,
        };
      });
    },
  };
}

async function getConceptEvidence(db: DbClient, conceptIds: string[]) {
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

async function getRelationshipEvidence(db: DbClient, relationshipIds: string[]) {
  const evidenceByRelationshipId = new Map<string, unknown[]>();

  for (const relationshipId of relationshipIds) {
    const rows = await db
      .select({
        blockId: sourcePassages.blockId,
        excerpt: wikiRelationshipSourceRefs.quote,
        location: wikiRelationshipSourceRefs.locationLabel,
        sourceId: sourcePassages.sourceId,
      })
      .from(wikiRelationshipSourceRefs)
      .innerJoin(sourcePassages, eq(wikiRelationshipSourceRefs.sourcePassageId, sourcePassages.id))
      .where(eq(wikiRelationshipSourceRefs.relationshipId, relationshipId));

    evidenceByRelationshipId.set(relationshipId, rows);
  }

  return evidenceByRelationshipId;
}

function toConceptDifficulty(value: string) {
  if (value === 'beginner' || value === 'intermediate' || value === 'advanced') {
    return value;
  }

  return 'beginner';
}

function relationshipMetadata(relationship: { evidenceQuality?: unknown }) {
  return relationship.evidenceQuality
    ? {
        evidenceQuality: relationship.evidenceQuality,
      }
    : null;
}

async function findOrCreateKnowledgebase(
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
    .values({
      projectId,
    })
    .onConflictDoUpdate({
      set: { updatedAt: new Date() },
      target: [knowledgebases.projectId],
    })
    .returning();

  return knowledgebase;
}

async function upsertSourcePassages(
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

function vectorLiteral(embedding: number[]) {
  return `[${embedding.join(',')}]`;
}

async function insertWikiProjection(
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

function getMappedId(ids: Map<string, string>, key: string, type: string) {
  const id = ids.get(key);

  if (!id) {
    throw new Error(`knowledgebase_${type}_row_missing:${key}`);
  }

  return id;
}

function getSourcePassageId(
  passageIdByRef: Map<string, string>,
  ref: { blockId: string; sourceId: string }
) {
  return getMappedId(passageIdByRef, sourceRefKey(ref.sourceId, ref.blockId), 'source_passage');
}

function sourceRefKey(sourceId: string, blockId: string) {
  return `${sourceId}:${blockId}`;
}

async function getConceptEvidenceCounts(db: DbClient, conceptIds: string[]) {
  const countsByConceptId = new Map<string, number>();

  if (conceptIds.length === 0) return countsByConceptId;

  const rows = await db
    .select({
      conceptId: wikiConceptSourceRefs.conceptId,
      count: sql<number>`count(*)`,
    })
    .from(wikiConceptSourceRefs)
    .where(or(...conceptIds.map(id => eq(wikiConceptSourceRefs.conceptId, id))))
    .groupBy(wikiConceptSourceRefs.conceptId);

  for (const row of rows) {
    countsByConceptId.set(row.conceptId, Number(row.count));
  }

  return countsByConceptId;
}

async function getRelationshipEvidenceCounts(db: DbClient, relationshipIds: string[]) {
  const countsByRelationshipId = new Map<string, number>();

  if (relationshipIds.length === 0) return countsByRelationshipId;

  const rows = await db
    .select({
      relationshipId: wikiRelationshipSourceRefs.relationshipId,
      count: sql<number>`count(*)`,
    })
    .from(wikiRelationshipSourceRefs)
    .where(or(...relationshipIds.map(id => eq(wikiRelationshipSourceRefs.relationshipId, id))))
    .groupBy(wikiRelationshipSourceRefs.relationshipId);

  for (const row of rows) {
    countsByRelationshipId.set(row.relationshipId, Number(row.count));
  }

  return countsByRelationshipId;
}
