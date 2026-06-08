import {
  ingestionAgentOutputDto,
  safeParse,
  scoreLinkEvidence,
  validateAndAnchorSourceRefs,
  type IngestionAgentOutput,
  type IngestionConcept,
  type IngestionConceptContext,
  type IngestionRelationClaim,
  type IngestionRelationship,
  type SourceBlockForValidation,
} from '@grasp/domain';
import type { createIngestionRetrievalTools } from './ingestion-retrieval.tools';
import { buildIngestionPrompt, ingestionAgent } from './ingestion.agent';

export type ExtractChunkInput = {
  blocks: SourceBlockForValidation[];
  chunkIndex: number;
  totalChunks: number;
  sourceId: string;
  draftConcepts: IngestionConcept[];
  draftRelationships: IngestionRelationship[];
  retrievedConcepts?: IngestionConceptContext[];
  retrievalTools?: ReturnType<typeof createIngestionRetrievalTools>;
  memory?: {
    resource: string;
    thread: string;
  };
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

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const retryInstructions =
        attempt > 1
          ? `\n\nPrevious response failed validation. Return a valid JSON object matching the requested schema.`
          : '';

      const response = input.retrievalTools
        ? await ingestionAgent.generate(prompt + retryInstructions, {

            structuredOutput: { schema: ingestionAgentOutputDto },
            maxSteps: 5,
            memory: input.memory,
            toolsets: {
              ingestionRetrieval: input.retrievalTools,
            },
          })
        : await ingestionAgent.generate(prompt + retryInstructions, {

            structuredOutput: { schema: ingestionAgentOutputDto },
            memory: input.memory,
          });

      const thinking = response.reasoningText ?? '';
      if (thinking && input.onThinking) {
        input.onThinking(thinking);
      }

      let parsedObj = response.object;

      if (!parsedObj && response.text) {
        try {
          const text = response.text.trim();
          const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
          if (jsonMatch) {
            parsedObj = JSON.parse(jsonMatch[1]);
          } else {
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
              parsedObj = JSON.parse(text.substring(firstBrace, lastBrace + 1));
            }
          }
        } catch (e) {
          console.warn('Failed to parse fallback JSON from response text:', e);
        }
      }

      if (!parsedObj) {
        throw new Error(
          `LLM returned undefined object. Raw text: ${response.text ? response.text.substring(0, 500) : 'none'}`
        );
      }

      const parsed = safeParse(ingestionAgentOutputDto, parsedObj);
      if (!parsed.success) {
        throw new Error(`ingestion_agent_schema_invalid: ${JSON.stringify(parsed.issues)}`);
      }

      const result = parsed.output;
      const validated = validateAgainstBlocks(result, input.blocks);

      return { ...validated, thinking };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[extractChunk] Attempt ${attempt} failed: ${lastError.message}`);
    }
  }

  throw lastError ?? new Error('Failed to extract chunk after multiple attempts');
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
