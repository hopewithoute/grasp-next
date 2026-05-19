import {
  ingestionAgentOutputDto,
  type IngestionAgentOutput,
  type IngestionConcept,
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

function extractThinkingAndJson(text: string): { thinking: string; json: string } {
  const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  const thinking = thinkingMatch?.[1]?.trim() ?? '';

  // JSON is everything after </thinking>, or the whole text if no thinking block
  let json = thinkingMatch
    ? text.slice(text.indexOf('</thinking>') + '</thinking>'.length).trim()
    : text.trim();

  // Strip markdown code fences if present
  json = json.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  return { thinking, json };
}

export type ExtractChunkInput = {
  blocks: SourceBlockForValidation[];
  chunkIndex: number;
  totalChunks: number;
  sourceId: string;
  draftConcepts: IngestionConcept[];
  draftRelationships: IngestionRelationship[];
  retrievalTools?: ReturnType<typeof createIngestionRetrievalTools>;
  onThinking?: (thinking: string) => void;
};

export type ExtractChunkResult = {
  concepts: IngestionConcept[];
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
        effectivePrompt = `${prompt}\n\n## CORRECTION REQUIRED (attempt ${attempt + 1}/${MAX_ATTEMPTS})\n\nYour previous response had an error:\n\`\`\`\n${lastError}\n\`\`\`\n\nFix this. Keep <thinking> brief. Ensure your JSON is complete and valid. Do not truncate.`;
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
      const extracted = extractThinkingAndJson(text);

      if (attempt === 0 && extracted.thinking && input.onThinking) {
        input.onThinking(extracted.thinking);
      }
      thinking = extracted.thinking || thinking;

      const parsed = parseLooseJsonResponse(extracted.json);
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
    relationships: [],
    thinking,
    droppedConceptKeys: [],
    droppedRefCount: 0,
  };
}

function validateAgainstBlocks(
  agentOutput: IngestionAgentOutput,
  blocks: SourceBlockForValidation[]
): {
  concepts: IngestionConcept[];
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
    droppedRefCount += relationship.sourceRefs.length - validatedRefs.length;

    if (validatedRefs.length === 0) {
      continue;
    }

    validatedRelationships.push({ ...relationship, sourceRefs: validatedRefs });
  }

  return {
    concepts: validatedConcepts,
    relationships: validatedRelationships,
    droppedConceptKeys,
    droppedRefCount,
  };
}

/**
 * Merge a chunk's extraction result into the accumulated draft.
 * Concepts with the same conceptKey are updated (last write wins for definition/confidence).
 * Relationships are deduplicated by (source+target+type).
 */
export function mergeDraft(
  draft: IngestionAgentOutput,
  chunkResult: Pick<ExtractChunkResult, 'concepts' | 'relationships'>
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
    relationships: newRelationships,
  };
}
