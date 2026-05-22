import {
  ingestionAgentOutputDto,
  knowledgebaseRelationshipTypeDto,
  type IngestionConceptContext,
  type IngestionAgentOutput,
  type IngestionConcept,
  type IngestionRelationClaim,
  type IngestionRelationship,
} from '@grasp/domain';
import { ingestionAgent } from './ingestion-agent';
import { buildIngestionPrompt } from './ingestion-prompt';
import type { createIngestionRetrievalTools } from './ingestion-retrieval-tools';
import { canUseAgentModel } from '../model-resolver';
import { getGeneratedText, parseLooseJsonResponse } from './response-helpers';
import {
  validateAndAnchorSourceRefs,
  type SourceBlockForValidation,
} from './validate-source-refs';
import { scoreLinkEvidence } from './linking';

export type ExtractChunkInput = {
  blocks: SourceBlockForValidation[];
  chunkIndex: number;
  totalChunks: number;
  sourceId: string;
  draftConcepts: IngestionConcept[];
  draftRelationships: IngestionRelationship[];
  retrievedConcepts?: IngestionConceptContext[];
  retrievalTools?: ReturnType<typeof createIngestionRetrievalTools>;
  onThinking?: (thinking: string) => void;
};

export type ExtractChunkResult = {
  concepts: IngestionConcept[];
  relationClaims: IngestionRelationClaim[];
  relationships: IngestionRelationship[];
  thinking: string;
  droppedConceptKeys: string[];
  droppedRefCount: number;
};

export async function extractChunk(input: ExtractChunkInput): Promise<ExtractChunkResult> {
  if (!canUseAgentModel('ingestionAgent', process.env)) {
    throw new Error(
      'No LLM provider configured for ingestionAgent. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_COMPATIBLE_BASE_URL+OPENAI_COMPATIBLE_API_KEY before running ingestion.'
    );
  }

  const prompt = buildIngestionPrompt({
    blocks: input.blocks,
    chunkIndex: input.chunkIndex,
    totalChunks: input.totalChunks,
    sourceId: input.sourceId,
    draftConcepts: input.draftConcepts.map((c) => ({
      conceptKey: c.conceptKey,
      name: c.name,
      definition: c.definition,
    })),
    retrievedConcepts: input.retrievedConcepts?.map((context) => ({
      conceptKey: context.concept.conceptKey,
      definition: context.concept.definition,
      name: context.concept.name,
      neighbors: context.neighbors,
    })),
  });

  const MAX_ATTEMPTS = 3;
  let lastError: string | null = null;
  let thinking = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      let effectivePrompt: string;

      if (attempt === 0) {
        effectivePrompt = prompt;
      } else {
        effectivePrompt = `${prompt}\n\n## CORRECTION REQUIRED (attempt ${attempt + 1}/${MAX_ATTEMPTS})\n\nYour previous response had an error:\n\`\`\`\n${lastError}\n\`\`\`\n\nFix this. Return compact complete JSON only. Use at most 4 concepts and at most 3 typed relationships. Ensure your JSON has all closing brackets/braces. Do not include markdown fences, prose, or separate reasoning text. Do not truncate.`;
      }

      const response = input.retrievalTools
        ? await ingestionAgent.generate(effectivePrompt, {
            maxSteps: 5,
            toolsets: {
              ingestionRetrieval: input.retrievalTools,
            },
          })
        : await ingestionAgent.generate(effectivePrompt);
      const text = getGeneratedText(response);
      const parsed = normalizeAgentOutput(parseLooseJsonResponse(text));
      const result = ingestionAgentOutputDto.parse(parsed);
      const validated = validateAgainstBlocks(result, input.blocks);
      return { ...validated, thinking };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }

  return {
    concepts: [],
    relationClaims: [],
    relationships: [],
    thinking,
    droppedConceptKeys: [],
    droppedRefCount: 0,
  };
}

export function normalizeAgentOutput(value: unknown) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;

  if (!Array.isArray(record.relationships)) {
    return value;
  }

  return {
    ...record,
    relationships: record.relationships.filter((relationship) => {
      return (
        relationship &&
        typeof relationship === 'object' &&
        knowledgebaseRelationshipTypeDto.safeParse(
          (relationship as Record<string, unknown>).relationshipType
        ).success
      );
    }),
  };
}

export function validateAgainstBlocks(
  agentOutput: IngestionAgentOutput,
  blocks: SourceBlockForValidation[]
): {
  concepts: IngestionConcept[];
  relationClaims: IngestionRelationClaim[];
  relationships: IngestionRelationship[];
  droppedConceptKeys: string[];
  droppedRefCount: number;
} {
  const droppedConceptKeys: string[] = [];
  let droppedRefCount = 0;

  const validatedConcepts: IngestionConcept[] = [];
  const survivingConceptKeys = new Set<string>();

  for (const concept of agentOutput.concepts) {
    const validatedRefs = validateAndAnchorSourceRefs(concept.sourceRefs, blocks);
    droppedRefCount += concept.sourceRefs.length - validatedRefs.length;

    if (validatedRefs.length === 0) {
      droppedConceptKeys.push(concept.conceptKey);
      continue;
    }

    validatedConcepts.push({ ...concept, sourceRefs: validatedRefs });
    survivingConceptKeys.add(concept.mergesWith ?? concept.conceptKey);
  }

  const validatedRelationships: IngestionRelationship[] = [];
  for (const relationship of agentOutput.relationships) {
    if (
      !survivingConceptKeys.has(relationship.sourceConceptKey) ||
      !survivingConceptKeys.has(relationship.targetConceptKey)
    ) {
      droppedRefCount += relationship.sourceRefs.length;
      continue;
    }

    const validatedRefs = validateAndAnchorSourceRefs(relationship.sourceRefs, blocks);
    const scoredRefs = validatedRefs.map((ref) => ({
      evidenceQuality: scoreLinkEvidence({
        quote: ref.quote,
        relationshipType: relationship.relationshipType,
        relationshipTypeConfidence: estimateLocalRelationshipTypeConfidence(relationship),
        semanticSupportConfidence: estimateLocalRelationshipSupportConfidence(relationship),
      }),
      ref,
    }));
    const usableRelationshipRefs = scoredRefs.filter(
      (item) => item.evidenceQuality.finalEvidenceScore >= 0.6
    );
    droppedRefCount += relationship.sourceRefs.length - usableRelationshipRefs.length;

    if (usableRelationshipRefs.length === 0) {
      continue;
    }

    const bestEvidenceQuality = usableRelationshipRefs
      .map((item) => item.evidenceQuality)
      .sort((a, b) => b.finalEvidenceScore - a.finalEvidenceScore)[0];

    validatedRelationships.push({
      ...relationship,
      evidenceQuality: bestEvidenceQuality,
      sourceRefs: usableRelationshipRefs.map((item) => item.ref),
    });
  }

  const validatedRelationClaims: IngestionRelationClaim[] = [];
  for (const claim of agentOutput.relationClaims) {
    const validatedRefs = validateAndAnchorSourceRefs(claim.sourceRefs, blocks);
    droppedRefCount += claim.sourceRefs.length - validatedRefs.length;

    if (validatedRefs.length === 0) {
      continue;
    }

    validatedRelationClaims.push({ ...claim, sourceRefs: validatedRefs });
  }

  return {
    concepts: validatedConcepts,
    relationClaims: validatedRelationClaims,
    relationships: validatedRelationships,
    droppedConceptKeys,
    droppedRefCount,
  };
}

function estimateLocalRelationshipSupportConfidence(relationship: IngestionRelationship) {
  const rationale = relationship.rationale?.toLowerCase() ?? '';

  if (rationale.includes('explicit') || rationale.includes('states')) {
    return 0.88;
  }

  return 0.82;
}

function estimateLocalRelationshipTypeConfidence(relationship: IngestionRelationship) {
  const evidenceText = [
    relationship.rationale ?? '',
    ...relationship.sourceRefs.map((ref) => ref.quote),
  ].join('\n');

  if (
    relationship.relationshipType === 'prerequisite' &&
    /\b(builds on|requires|depends on|foundational|prerequisite)\b/i.test(evidenceText)
  ) {
    return 0.9;
  }

  if (
    relationship.relationshipType === 'part_of' &&
    /\b(part of|component|includes|contains|consists of)\b/i.test(evidenceText)
  ) {
    return 0.88;
  }

  if (
    relationship.relationshipType === 'explains' &&
    /\b(explains|because|therefore|causes|leads to)\b/i.test(evidenceText)
  ) {
    return 0.88;
  }

  return relationship.relationshipType === 'related_to' ? 0.78 : 0.72;
}

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
    draft.relationships.map((r) => `${r.sourceConceptKey}:${r.targetConceptKey}:${r.relationshipType}`)
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
