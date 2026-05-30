import { chunkNormalizedBlocks, type IngestionChunk } from './chunk-normalized-blocks';
import { normalizeMarkdownSource } from '../sources/normalize-markdown-source';
import { mergeDraft } from './merge-draft';
import { buildLinkCandidates, type LinkTrace } from './linking';
import type { IngestionAiPort, EvaluateLinkCandidatesPortOutput } from './ingestion-ai.port';
import type { IngestionConceptContext, IngestionConceptSearchResult } from '../knowledgebase';
import type { IngestionAgentOutput } from './ingestion-agent.dto';

export type IngestionStreamEvent =
  | { type: 'ingestion_started'; sourceId: string; sourceTitle: string }
  | { type: 'chunk_processing'; chunkIndex: number; totalChunks: number }
  | { type: 'agent_thinking'; chunkIndex: number; thinking: string }
  | {
      type: 'retrieval_activity';
      hitCount: number;
      query: string;
      retrievalType: 'concept_search' | 'concept_neighbors';
    }
  | { type: 'concept_extracted'; conceptKey: string; name: string; isNew: boolean }
  | {
      type: 'link_applied';
      candidateId: string;
      relationshipType: string;
      sourceConceptName: string;
      targetConceptName: string;
    }
  | {
      type: 'link_candidate_generated';
      candidateId: string;
      relationshipType: string;
      resolutionType: 'exact' | 'semantic';
      sourceConceptName: string;
      targetConceptName: string;
    }
  | {
      type: 'link_candidate_reviewed';
      candidateId: string;
      confidence: number;
      decision: 'accept' | 'reject';
      evidenceStrength: 'strong' | 'usable' | 'weak' | 'rejected';
      finalEvidenceScore: number;
    }
  | {
      type: 'link_policy_applied';
      candidateId: string;
      decision: 'accept' | 'reject';
      reason: string;
    }
  | {
      type: 'link_rejected';
      candidateId: string;
      reason: string;
      sourceConceptName: string;
      targetConceptName: string;
    }
  | {
      type: 'relation_claim_extracted';
      objectText: string;
      predicate: string;
      subjectText: string;
    }
  | { type: 'relationship_extracted'; source: string; target: string }
  | {
      type: 'evidence_dropped';
      chunkIndex: number;
      droppedConceptKeys: string[];
      droppedRefCount: number;
    }
  | { type: 'ingestion_complete'; conceptCount: number; relationshipCount: number }
  | { type: 'ingestion_failed'; reason: string };

export interface IngestionRunRepositoryPort {
  create(params: { projectId: string; sourceId: string }): Promise<{ id: string }>;
  markCompleted(id: string, result: Record<string, unknown>): Promise<unknown>;
  markFailed(id: string, reason: string): Promise<unknown>;
}

export interface KnowledgebaseRepositoryPort {
  upsertSourcePassages(params: { blocks: unknown[]; projectId: string; sourceId: string }): Promise<unknown>;
  getConceptContext(params: { conceptKey: string; projectId: string }): Promise<IngestionConceptContext | null>;
  searchConceptsForIngestion(params: { query: string; projectId: string; limit?: number; embedding?: number[] }): Promise<Array<IngestionConceptSearchResult>>;
  mergeIngestionOutput(params: { projectId: string; sourceId: string; conceptEmbeddingsByKey?: Record<string, number[]>; output: IngestionAgentOutput }): Promise<unknown>;
}

export async function ingestSourceAction(
  input: {
    projectId: string;
    sourceId: string;
    sourceTitle: string;
    content: string;
    onEvent?: (event: IngestionStreamEvent) => void;
  },
  deps: {
    aiPort: IngestionAiPort;
    ingestionRunRepository: IngestionRunRepositoryPort;
    knowledgebaseRepository: KnowledgebaseRepositoryPort;
  }
) {
  const emit = input.onEvent ?? (() => {});

  const ingestionRun = await deps.ingestionRunRepository.create({
    projectId: input.projectId,
    sourceId: input.sourceId,
  });

  try {
    emit({ type: 'ingestion_started', sourceId: input.sourceId, sourceTitle: input.sourceTitle });

    if (input.content.trim() === '') {
      await deps.ingestionRunRepository.markCompleted(ingestionRun.id, {});
      emit({ type: 'ingestion_complete', conceptCount: 0, relationshipCount: 0 });
      return;
    }

    const normalized = normalizeMarkdownSource({
      sourceId: input.sourceId,
      sourceMaterial: input.content,
      title: input.sourceTitle,
    });
    
    await deps.knowledgebaseRepository.upsertSourcePassages({
      blocks: normalized.blocks,
      projectId: input.projectId,
      sourceId: input.sourceId,
    });

    const chunks = chunkNormalizedBlocks(normalized.blocks);
    
    const extracted = await extractAndMergeChunks(
      chunks, 
      { projectId: input.projectId, sourceId: input.sourceId, emit }, 
      deps.aiPort
    );

    let draft = extracted.draft;
    const totalDroppedRefs = extracted.totalDroppedRefs;
    const totalDroppedConceptKeys = extracted.totalDroppedConceptKeys;

    let linkTrace: LinkTrace | null = null;

    if (chunks.length > 0) {
      const linkingResult = await linkExtractedConcepts(
        draft,
        { projectId: input.projectId, emit },
        deps
      );
      
      draft = linkingResult.patchedExtraction;
      linkTrace = linkingResult.linkTrace;

      const embeddingsResult = await deps.aiPort.embedConcepts(draft.concepts);

      await deps.knowledgebaseRepository.mergeIngestionOutput({
         conceptEmbeddingsByKey: embeddingsResult.embeddingsByKey,
         projectId: input.projectId,
         sourceId: input.sourceId,
         output: draft
      });
    }

    await deps.ingestionRunRepository.markCompleted(ingestionRun.id, {
      chunkCount: chunks.length,
      conceptCount: draft.concepts.length,
      droppedConceptKeys: totalDroppedConceptKeys,
      droppedRefCount: totalDroppedRefs,
      linking: linkTrace,
      relationshipCount: draft.relationships.length,
    });

    emit({ type: 'ingestion_complete', conceptCount: draft.concepts.length, relationshipCount: draft.relationships.length });

  } catch (err) {
    await deps.ingestionRunRepository.markFailed(ingestionRun.id, err instanceof Error ? err.message : 'failed');
    throw err;
  }
}

// --- Internal Helper Functions ---

async function extractAndMergeChunks(
  chunks: IngestionChunk[],
  context: { projectId: string; sourceId: string; emit: (e: IngestionStreamEvent) => void },
  aiPort: IngestionAiPort
) {
  let draft: IngestionAgentOutput = { concepts: [], relationships: [], relationClaims: [] };
  let totalDroppedRefs = 0;
  const totalDroppedConceptKeys: string[] = [];
  
  for (const chunk of chunks) {
    context.emit({ type: 'chunk_processing', chunkIndex: chunk.chunkIndex, totalChunks: chunks.length });
    
    const extraction = await aiPort.extractConceptsFromChunk({
       projectId: context.projectId,
       sourceId: context.sourceId,
       chunkIndex: chunk.chunkIndex,
       totalChunks: chunks.length,
       blocks: chunk.blocks,
       draftConcepts: draft.concepts,
       draftRelationships: draft.relationships,
       onThinking: (thinking) => context.emit({ type: 'agent_thinking', chunkIndex: chunk.chunkIndex, thinking }),
       onRetrieval: (hitCount, query, retrievalType) => context.emit({ type: 'retrieval_activity', hitCount, query, retrievalType })
    });

    if (extraction.droppedRefCount > 0 || extraction.droppedConceptKeys.length > 0) {
      totalDroppedRefs += extraction.droppedRefCount;
      totalDroppedConceptKeys.push(...extraction.droppedConceptKeys);
      context.emit({
        type: 'evidence_dropped',
        chunkIndex: chunk.chunkIndex,
        droppedConceptKeys: extraction.droppedConceptKeys,
        droppedRefCount: extraction.droppedRefCount,
      });
    }

    if (extraction.concepts.length > 0) {
      emitExtractionEvents(extraction, draft, context.emit);
      draft = mergeDraft(draft, extraction);
    }
  }

  return { draft, totalDroppedRefs, totalDroppedConceptKeys };
}

function emitExtractionEvents(extraction: IngestionAgentOutput, draft: IngestionAgentOutput, emit: (e: IngestionStreamEvent) => void) {
  const draftKeys = new Set(draft.concepts.map((concept) => concept.conceptKey));
  
  for (const c of extraction.concepts) {
    const effectiveKey = c.mergesWith ?? c.conceptKey;
    emit({
      type: 'concept_extracted',
      conceptKey: effectiveKey,
      name: c.name,
      isNew: !draftKeys.has(effectiveKey),
    });
  }
  for (const r of extraction.relationships) {
    emit({
      type: 'relationship_extracted',
      source: r.sourceConceptKey,
      target: r.targetConceptKey,
    });
  }
  for (const claim of extraction.relationClaims) {
    emit({
      type: 'relation_claim_extracted',
      objectText: claim.objectText,
      predicate: claim.predicate,
      subjectText: claim.subjectText,
    });
  }
}

async function linkExtractedConcepts(
  draft: IngestionAgentOutput,
  context: { projectId: string; emit: (e: IngestionStreamEvent) => void },
  deps: { aiPort: IngestionAiPort; knowledgebaseRepository: KnowledgebaseRepositoryPort }
) {
  const candidates = await buildLinkCandidates({
    getConceptContext: (conceptKey) =>
      deps.knowledgebaseRepository.getConceptContext({
        conceptKey,
        projectId: context.projectId,
      }),
    localExtraction: draft,
    searchConcepts: async ({ query, limit }: { query: string, limit?: number }) => {
      return deps.knowledgebaseRepository.searchConceptsForIngestion({
        limit,
        projectId: context.projectId,
        query,
      });
    },
  });

  for (const candidate of candidates) {
    context.emit({
      type: 'link_candidate_generated',
      candidateId: candidate.candidateId,
      relationshipType: candidate.relationshipType,
      resolutionType: candidate.resolutionType,
      sourceConceptName: candidate.sourceConceptName,
      targetConceptName: candidate.targetConceptName,
    });
  }

  const linkingResult = await deps.aiPort.evaluateLinkCandidates({
     projectId: context.projectId,
     candidates,
     extraction: draft
  });

  emitLinkingEvents(linkingResult, context.emit);

  return { 
    patchedExtraction: linkingResult.patchedExtraction, 
    linkTrace: linkingResult.trace 
  };
}

function emitLinkingEvents(linkingResult: EvaluateLinkCandidatesPortOutput, emit: (e: IngestionStreamEvent) => void) {
  for (const link of linkingResult.reviewedLinks ?? []) {
    emit({
      type: 'link_candidate_reviewed',
      candidateId: link.candidateId,
      confidence: link.confidence,
      decision: link.decision,
      evidenceStrength: link.evidenceQuality.evidenceStrength,
      finalEvidenceScore: link.evidenceQuality.finalEvidenceScore,
    });
  }
  for (const result of linkingResult.policyResults ?? []) {
    emit({
      type: 'link_policy_applied',
      candidateId: result.candidateId,
      decision: result.decision,
      reason: result.reason,
    });
  }
  for (const link of linkingResult.acceptedLinks ?? []) {
    emit({
      type: 'link_applied',
      candidateId: link.candidateId,
      relationshipType: link.relationshipType,
      sourceConceptName: link.sourceConceptName,
      targetConceptName: link.targetConceptName,
    });
  }
  for (const link of linkingResult.rejectedLinks ?? []) {
    emit({
      type: 'link_rejected',
      candidateId: link.candidateId,
      reason: link.rationale,
      sourceConceptName: link.sourceConceptName,
      targetConceptName: link.targetConceptName,
    });
  }
}
