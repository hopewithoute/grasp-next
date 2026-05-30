import {
  ingestionAgentOutputDto,
  validateAndAnchorSourceRefs,
  type SourceBlockForValidation,
  type IngestionConceptContext,
  type IngestionAgentOutput,
  type IngestionConcept,
  type IngestionRelationClaim,
  type IngestionRelationship,
} from '@grasp/domain';
import type { MastraDBMessage } from '@mastra/core/agent';
import { ingestionAgent } from './ingestion-agent';
import { buildIngestionPrompt } from './ingestion-agent';
import type { createIngestionRetrievalTools } from './ingestion-retrieval-tools';

import { scoreLinkEvidence } from '@grasp/domain';

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

export type IngestionMastraRunArtifact = {
  messages: MastraDBMessage[];
  text: string;
  attempts: number;
};

export type IngestionChunkAgentRunResult = {
  domain: ExtractChunkResult;
  mastra: IngestionMastraRunArtifact;
};

export async function extractChunk(input: ExtractChunkInput): Promise<ExtractChunkResult> {
  const result = await runIngestionChunkAgent(input);
  return result.domain;
}

export async function runIngestionChunkAgent(
  input: ExtractChunkInput
): Promise<IngestionChunkAgentRunResult> {
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
  let latestMessages: MastraDBMessage[] = [];
  let latestText = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const effectivePrompt =
        attempt === 0
          ? prompt
          : `${prompt}\n\n## RETRY (attempt ${attempt + 1}/${MAX_ATTEMPTS})\n\nPrevious attempt failed with error:\n\`\`\`\n${lastError}\n\`\`\`\n\nPlease try again.`;

      const response = input.retrievalTools
        ? await ingestionAgent.generate(effectivePrompt, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            structuredOutput: { schema: ingestionAgentOutputDto as any },
            maxSteps: 5,
            memory: input.memory,
            toolsets: {
              ingestionRetrieval: input.retrievalTools,
            },
            onIterationComplete: ({ messages }: { messages: MastraDBMessage[] }) => {
              latestMessages = messages;
            },
          })
        : await ingestionAgent.generate(effectivePrompt, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            structuredOutput: { schema: ingestionAgentOutputDto as any },
            memory: input.memory,
            onIterationComplete: ({ messages }: { messages: MastraDBMessage[] }) => {
              latestMessages = messages;
            },
          });

      latestText = JSON.stringify(response.object);
      thinking = response.reasoningText ?? '';
      if (thinking && input.onThinking) {
        input.onThinking(thinking);
      }
      const parsed = ingestionAgentOutputDto.safeParse(response.object);
      if (!parsed.success) {
        throw parsed.error;
      }
      const result = parsed.data as IngestionAgentOutput;
      const validated = validateAgainstBlocks(result, input.blocks);
      return {
        domain: { ...validated, thinking },
        mastra: {
          messages: latestMessages,
          text: latestText,
          attempts: attempt + 1,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }

  throw lastError ? new Error(lastError) : new Error('Ingestion failed after all attempts');
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


