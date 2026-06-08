import type {
  IngestionAgentOutput,
  IngestionConcept,
  IngestionRelationClaim,
  IngestionRelationship,
} from '../index';

export type ExtractChunkResult = {
  concepts: IngestionConcept[];
  relationClaims: IngestionRelationClaim[];
  relationships: IngestionRelationship[];
};

/**
 * Merge a chunk's extraction result into the accumulated draft.
 * Concepts with the same conceptKey are updated (last write wins for definition/confidence).
 * Relationships are deduplicated by (source+target+type).
 */
export function mergeDraft(
  draft: IngestionAgentOutput,
  chunkResult: Pick<ExtractChunkResult, 'concepts' | 'relationClaims' | 'relationships'>
): IngestionAgentOutput {
  const conceptsByKey = new Map<string, IngestionConcept>(
    draft.concepts.map((c) => [c.conceptKey, c])
  );

  for (const concept of chunkResult.concepts) {
    const effectiveKey = concept.mergesWith ?? concept.conceptKey;
    const existing = conceptsByKey.get(effectiveKey);

    if (existing) {
      conceptsByKey.set(effectiveKey, {
        ...existing,
        confidence: Math.max(existing.confidence, concept.confidence),
        definition: concept.definition,
        difficulty: concept.difficulty,
        name: concept.name,
        sourceRefs: [...existing.sourceRefs, ...concept.sourceRefs],
      });
    } else {
      conceptsByKey.set(effectiveKey, { ...concept, conceptKey: effectiveKey });
    }
  }

  const relKeySet = new Set<string>(
    draft.relationships.map(
      (r) => `${r.sourceConceptKey}:${r.targetConceptKey}:${r.relationshipType}`
    )
  );
  const newRelationships: IngestionRelationship[] = [...draft.relationships];

  for (const rel of chunkResult.relationships) {
    const key = `${rel.sourceConceptKey}:${rel.targetConceptKey}:${rel.relationshipType}`;
    if (!relKeySet.has(key)) {
      relKeySet.add(key);
      newRelationships.push(rel);
    }
  }

  return {
    concepts: [...conceptsByKey.values()],
    relationClaims: [...draft.relationClaims, ...chunkResult.relationClaims],
    relationships: newRelationships,
  };
}
