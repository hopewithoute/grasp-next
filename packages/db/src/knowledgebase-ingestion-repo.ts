import { and, eq, max } from "drizzle-orm";
import type { KnowledgebaseIngestionRepository } from "@grasp/domain";
import { KNOWLEDGEBASE_VERSION_STATUS } from '@grasp/domain';
import type { DbClient } from './client';
import {
  knowledgebases,
  knowledgebaseVersions,
  sourcePassages,
  wikiConcepts,
  wikiConceptSourceRefs,
  wikiRelationships,
  wikiRelationshipSourceRefs,
} from './schema';
import {
  findOrCreateKnowledgebase,
  insertWikiProjection,
  relationshipMetadata,
  upsertSourcePassages as upsertSourcePassagesFromContent,
} from './knowledgebase-helpers';

export function createKnowledgebaseIngestionMethods(db: DbClient): KnowledgebaseIngestionRepository {
  return {
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
            (
              await tx
                .select({ id: wikiConcepts.id })
                .from(wikiConcepts)
                .where(eq(wikiConcepts.knowledgebaseId, knowledgebase.id))
            ).map((c) => c.id)
          );
          const relationships = await tx
            .select({
              id: wikiRelationships.id,
              sourceConceptId: wikiRelationships.sourceConceptId,
              targetConceptId: wikiRelationships.targetConceptId,
            })
            .from(wikiRelationships)
            .where(eq(wikiRelationships.knowledgebaseId, knowledgebase.id));

          for (const rel of relationships) {
            if (
              !remainingConceptIds.has(rel.sourceConceptId) ||
              !remainingConceptIds.has(rel.targetConceptId)
            ) {
              await tx.delete(wikiRelationships).where(eq(wikiRelationships.id, rel.id));
            }
          }
        }

        // Resolve concept IDs (existing + newly extracted)
        const existingConcepts = await tx
          .select({ id: wikiConcepts.id, conceptKey: wikiConcepts.conceptKey })
          .from(wikiConcepts)
          .where(eq(wikiConcepts.knowledgebaseId, knowledgebase.id));
        const conceptIdByKey = new Map(existingConcepts.map((c) => [c.conceptKey, c.id]));

        // Upsert concepts from extraction output
        for (const concept of input.output.concepts) {
          const existing = conceptIdByKey.get(concept.conceptKey);
          const lookupKey = concept.mergesWith ?? concept.conceptKey;
          const embedding = input.conceptEmbeddingsByKey?.[lookupKey] ?? input.conceptEmbeddingsByKey?.[concept.conceptKey] ?? null;
          console.log(`[mergeIngestionOutput] concept: ${concept.conceptKey}, lookupKey: ${lookupKey}, hasEmbedding: ${!!embedding}`);

          if (existing) {
            await tx
              .update(wikiConcepts)
              .set({
                confidence: concept.confidence,
                definition: concept.definition,
                difficulty: concept.difficulty,
                name: concept.name,
                embedding,
                updatedAt: new Date(),
              })
              .where(eq(wikiConcepts.id, existing));
          } else {
            const [inserted] = await tx
              .insert(wikiConcepts)
              .values({
                conceptKey: concept.conceptKey,
                confidence: concept.confidence,
                definition: concept.definition,
                difficulty: concept.difficulty,
                knowledgebaseId: knowledgebase.id,
                knowledgebaseVersionId: null,
                metadata: null,
                name: concept.name,
                embedding,
              })
              .returning();
            conceptIdByKey.set(concept.conceptKey, inserted.id);
          }
        }

        // Upsert relationships
        for (const relationship of input.output.relationships) {
          const sourceConceptId = conceptIdByKey.get(relationship.sourceConceptKey);
          const targetConceptId = conceptIdByKey.get(relationship.targetConceptKey);

          if (!sourceConceptId || !targetConceptId) {
            continue;
          }

          const relationshipKey = `${relationship.sourceConceptKey}:${relationship.targetConceptKey}:${relationship.relationshipType}`;

          await tx
            .insert(wikiRelationships)
            .values({
              knowledgebaseId: knowledgebase.id,
              relationshipKey,
              sourceConceptId,
              targetConceptId,
              relationshipType: relationship.relationshipType,
              rationale: relationship.rationale,
              metadata: relationshipMetadata(relationship),
            })
            .onConflictDoUpdate({
              target: [wikiRelationships.knowledgebaseId, wikiRelationships.relationshipKey],
              set: {
                relationshipType: relationship.relationshipType,
                rationale: relationship.rationale,
                updatedAt: new Date(),
              },
            });
        }

        // Insert source passage refs for evidence
        const passages = await tx
          .select({ id: sourcePassages.id, blockId: sourcePassages.blockId })
          .from(sourcePassages)
          .where(
            and(
              eq(sourcePassages.projectId, input.projectId),
              eq(sourcePassages.sourceId, input.sourceId)
            )
          );
        const passageByBlockId = new Map(passages.map((p) => [p.blockId, p.id]));

        for (const concept of input.output.concepts) {
          const conceptId = conceptIdByKey.get(concept.conceptKey);
          if (!conceptId || !concept.sourceRefs?.length) continue;

          for (const ref of concept.sourceRefs) {
            const passageId = passageByBlockId.get(ref.blockId) || passageByBlockId.get(`${input.sourceId}:${ref.blockId}`);
            if (!passageId) continue;

            await tx
              .insert(wikiConceptSourceRefs)
              .values({
                conceptId,
                sourcePassageId: passageId,
                quote: ref.quote,
                locationLabel: ref.locationLabel,
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
          await tx
            .delete(wikiConceptSourceRefs)
            .where(eq(wikiConceptSourceRefs.sourcePassageId, passageId));
          await tx
            .delete(wikiRelationshipSourceRefs)
            .where(eq(wikiRelationshipSourceRefs.sourcePassageId, passageId));
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

    async replaceVersionFromContent(input) {
      return db.transaction(async (tx) => {
        const knowledgebase = await findOrCreateKnowledgebase(tx, input.projectId);

        await upsertSourcePassagesFromContent(tx, input.projectId, input.content);

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

        await insertWikiProjection(
          tx,
          input.projectId,
          knowledgebase.id,
          version.id,
          input.content
        );

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
