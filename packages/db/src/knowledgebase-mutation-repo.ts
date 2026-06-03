import { and, eq, exists, max } from "drizzle-orm";
import type { KnowledgebaseMutationRepository } from '@grasp/domain';
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
} from './schema';

export function createKnowledgebaseMutationMethods(db: DbClient): KnowledgebaseMutationRepository {
  return {
    async addConcept(input) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, input.projectId))
        .limit(1);

      if (!knowledgebase) {
        throw new Error(`Knowledgebase not found for project ${input.projectId}`);
      }

      await db
        .insert(wikiConcepts)
        .values({
          knowledgebaseId: knowledgebase.id,
          conceptKey: input.conceptKey,
          name: input.name,
          definition: input.definition,
          difficulty: input.difficulty,
          confidence: input.confidence,
          metadata: input.metadata,
        })
        .onConflictDoUpdate({
          target: [wikiConcepts.knowledgebaseId, wikiConcepts.conceptKey],
          set: {
            name: input.name,
            definition: input.definition,
            difficulty: input.difficulty,
            confidence: input.confidence,
            metadata: input.metadata,
            updatedAt: new Date(),
          },
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

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.definition !== undefined) updates.definition = input.definition;
      if (input.difficulty !== undefined) updates.difficulty = input.difficulty;
      if (input.confidence !== undefined) updates.confidence = input.confidence;
      if (input.metadata !== undefined) updates.metadata = input.metadata;

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

    async tombstoneConcept(input) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, input.projectId))
        .limit(1);

      if (!knowledgebase) return;

      const [existing] = await db
        .select({ metadata: wikiConcepts.metadata })
        .from(wikiConcepts)
        .where(
          and(
            eq(wikiConcepts.knowledgebaseId, knowledgebase.id),
            eq(wikiConcepts.conceptKey, input.conceptKey)
          )
        )
        .limit(1);

      if (!existing) return;

      const currentMetadata = (existing.metadata as Record<string, unknown>) || {};
      const newMetadata = { ...currentMetadata, status: 'deleted' };

      await db
        .update(wikiConcepts)
        .set({ metadata: newMetadata, updatedAt: new Date() })
        .where(
          and(
            eq(wikiConcepts.knowledgebaseId, knowledgebase.id),
            eq(wikiConcepts.conceptKey, input.conceptKey)
          )
        );
    },

    async cleanupOrphans(projectId: string) {
      const [knowledgebase] = await db
        .select()
        .from(knowledgebases)
        .where(eq(knowledgebases.projectId, projectId))
        .limit(1);

      if (!knowledgebase) return;

      const conceptsInKb = await db
        .select({ id: wikiConcepts.id })
        .from(wikiConcepts)
        .where(eq(wikiConcepts.knowledgebaseId, knowledgebase.id));

      for (const concept of conceptsInKb) {
        const [hasRefs] = await db
          .select({ id: wikiConceptSourceRefs.id })
          .from(wikiConceptSourceRefs)
          .where(eq(wikiConceptSourceRefs.conceptId, concept.id))
          .limit(1);

        if (!hasRefs) {
          await db.delete(wikiConcepts).where(eq(wikiConcepts.id, concept.id));
        }
      }
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
        .select({ id: wikiConcepts.id })
        .from(wikiConcepts)
        .where(
          and(
            eq(wikiConcepts.knowledgebaseId, knowledgebase.id),
            eq(wikiConcepts.conceptKey, input.sourceConceptKey)
          )
        )
        .limit(1);

      const [targetConcept] = await db
        .select({ id: wikiConcepts.id })
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

      await db
        .insert(wikiRelationships)
        .values({
          knowledgebaseId: knowledgebase.id,
          relationshipKey: input.relationshipKey,
          sourceConceptId: sourceConcept.id,
          targetConceptId: targetConcept.id,
          relationshipType: input.relationshipType,
          rationale: input.rationale,
          metadata: input.metadata,
        })
        .onConflictDoUpdate({
          target: [wikiRelationships.knowledgebaseId, wikiRelationships.relationshipKey],
          set: {
            relationshipType: input.relationshipType,
            rationale: input.rationale,
            metadata: input.metadata,
            updatedAt: new Date(),
          },
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

      const updates: Record<string, unknown> = {};
      if (input.quote !== undefined) updates.quote = input.quote;
      if (input.locationLabel !== undefined) updates.locationLabel = input.locationLabel;

      await db
        .update(wikiConceptSourceRefs)
        .set(updates)
        .where(
          and(
            eq(wikiConceptSourceRefs.id, input.evidenceId),
            exists(
              db
                .select()
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
      await db.delete(wikiConceptSourceRefs).where(
        and(
          eq(wikiConceptSourceRefs.id, input.evidenceId),
          exists(
            db
              .select()
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

        const sourceTitle = input.sourceType === 'text' ? 'User Chat Correction' : input.title;

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
