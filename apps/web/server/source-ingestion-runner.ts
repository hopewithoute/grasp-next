import 'server-only';

import {
  chunkNormalizedBlocks,
  type IngestionConceptContext,
  normalizeMarkdownSource,
  type IngestionAgentOutput,
} from '@grasp/domain';
import {
  createIngestionRetrievalTools,
  buildLinkCandidates,
  extractChunk,
  mergeDraft,
  sourceLinkingWorkflow,
} from '@grasp/ai/ingestion';
import { canUseEmbeddingModel, embedText, embedTexts } from '@grasp/ai/embeddings';
import { canUseAgentModel } from '@grasp/ai/model-resolver';
import type { createProjectDeps } from './project-deps';

type ProjectDeps = ReturnType<typeof createProjectDeps>;

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

export async function runSourceIngestion(
  input: {
    content: string;
    onEvent?: (event: IngestionStreamEvent) => void;
    projectId: string;
    sourceId: string;
    sourceTitle: string;
    sourceType: 'markdown' | 'text';
  },
  deps: ProjectDeps
) {
  const emit = input.onEvent ?? (() => {});

  const ingestionRun = await deps.ingestionRunRepository.create({
    projectId: input.projectId,
    sourceId: input.sourceId,
  });

  try {
    emit({ type: 'ingestion_started', sourceId: input.sourceId, sourceTitle: input.sourceTitle });

    if (!canUseAgentModel('ingestionAgent', process.env)) {
      throw new Error(
        'No LLM provider configured for ingestionAgent. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_COMPATIBLE_BASE_URL+OPENAI_COMPATIBLE_API_KEY before running ingestion.'
      );
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
    let draft: IngestionAgentOutput = { concepts: [], relationClaims: [], relationships: [] };
    let totalDroppedRefs = 0;
    const totalDroppedConceptKeys: string[] = [];
    const retrievalTools = createIngestionRetrievalTools({
      getConceptContext: (conceptKey) =>
        deps.knowledgebaseRepository
          .getConceptContext({
            conceptKey,
            projectId: input.projectId,
          })
          .then((context) => {
            emit({
              type: 'retrieval_activity',
              hitCount: context?.neighbors.length ?? 0,
              query: conceptKey,
              retrievalType: 'concept_neighbors',
            });
            return context;
          }),
      searchWikiConcepts: async (query, limit) => {
        const embedding = await embedQuery(query);

        const concepts = await deps.knowledgebaseRepository.searchConceptsForIngestion({
          embedding,
          limit,
          projectId: input.projectId,
          query,
        });
        emit({
          type: 'retrieval_activity',
          hitCount: concepts.length,
          query,
          retrievalType: 'concept_search',
        });
        return concepts;
      },
    });

    for (const chunk of chunks) {
      emit({ type: 'chunk_processing', chunkIndex: chunk.chunkIndex, totalChunks: chunks.length });
      const retrievedConcepts = await retrieveExistingConceptContext({
        blocks: chunk.blocks.map((block) => block.text),
        emit,
        projectId: input.projectId,
        deps,
      });

      const result = await extractChunk({
        blocks: chunk.blocks.map((block) => ({ id: block.id, text: block.text })),
        chunkIndex: chunk.chunkIndex,
        draftConcepts: draft.concepts,
        draftRelationships: draft.relationships,
        retrievedConcepts,
        retrievalTools,
        sourceId: input.sourceId,
        totalChunks: chunks.length,
        onThinking: (thinking) => emit({ type: 'agent_thinking', chunkIndex: chunk.chunkIndex, thinking }),
      });

      if (result.droppedRefCount > 0 || result.droppedConceptKeys.length > 0) {
        totalDroppedRefs += result.droppedRefCount;
        totalDroppedConceptKeys.push(...result.droppedConceptKeys);
        emit({
          type: 'evidence_dropped',
          chunkIndex: chunk.chunkIndex,
          droppedConceptKeys: result.droppedConceptKeys,
          droppedRefCount: result.droppedRefCount,
        });
      }

      if (result.concepts.length > 0) {
        const draftKeys = new Set(draft.concepts.map((concept) => concept.conceptKey));
        await Promise.all(
          result.concepts.map(async (c) => {
            const effectiveKey = c.mergesWith ?? c.conceptKey;
            const existingContext = await deps.knowledgebaseRepository.getConceptContext({
              conceptKey: effectiveKey,
              projectId: input.projectId,
            });
            emit({
              type: 'concept_extracted',
              conceptKey: effectiveKey,
              name: c.name,
              isNew: !draftKeys.has(effectiveKey) && !existingContext,
            });
          })
        );
        for (const r of result.relationships) {
          emit({ type: 'relationship_extracted', source: r.sourceConceptKey, target: r.targetConceptKey });
        }
        for (const claim of result.relationClaims) {
          emit({
            type: 'relation_claim_extracted',
            objectText: claim.objectText,
            predicate: claim.predicate,
            subjectText: claim.subjectText,
          });
        }
        draft = mergeDraft(draft, result);
      }
    }

    const linkCandidates = await buildLinkCandidates({
      getConceptContext: (conceptKey) =>
        deps.knowledgebaseRepository.getConceptContext({
          conceptKey,
          projectId: input.projectId,
        }),
      localExtraction: draft,
      searchConcepts: async ({ query, limit }) => {
        const embedding = await embedQuery(query);

        return deps.knowledgebaseRepository.searchConceptsForIngestion({
          embedding,
          limit,
          projectId: input.projectId,
          query,
        });
      },
    });
    for (const candidate of linkCandidates) {
      emit({
        type: 'link_candidate_generated',
        candidateId: candidate.candidateId,
        relationshipType: candidate.relationshipType,
        resolutionType: candidate.resolutionType,
        sourceConceptName: candidate.sourceConceptName,
        targetConceptName: candidate.targetConceptName,
      });
    }
    const linkingRun = await sourceLinkingWorkflow.createRun({
      resourceId: input.projectId,
    });
    const linkingResult = await linkingRun.start({
      inputData: {
        candidates: linkCandidates,
        extraction: draft,
        useModel: true,
      },
    });
    if (linkingResult.status !== 'success') {
      throw new Error(`linking_workflow_${linkingResult.status}`);
    }
    for (const link of linkingResult.result?.reviewedLinks ?? []) {
      emit({
        type: 'link_candidate_reviewed',
        candidateId: link.candidateId,
        confidence: link.confidence,
        decision: link.decision,
        evidenceStrength: link.evidenceQuality.evidenceStrength,
        finalEvidenceScore: link.evidenceQuality.finalEvidenceScore,
      });
    }
    for (const result of linkingResult.result?.policyResults ?? []) {
      emit({
        type: 'link_policy_applied',
        candidateId: result.candidateId,
        decision: result.decision,
        reason: result.reason,
      });
    }
    for (const link of linkingResult.result?.acceptedLinks ?? []) {
      emit({
        type: 'link_applied',
        candidateId: link.candidateId,
        relationshipType: link.relationshipType,
        sourceConceptName: link.sourceConceptName,
        targetConceptName: link.targetConceptName,
      });
    }
    for (const link of linkingResult.result?.rejectedLinks ?? []) {
      emit({
        type: 'link_rejected',
        candidateId: link.candidateId,
        reason: link.rationale,
        sourceConceptName: link.sourceConceptName,
        targetConceptName: link.targetConceptName,
      });
    }
    draft = linkingResult.result?.patchedExtraction ?? draft;

    const conceptEmbeddings = await embedConcepts(draft.concepts);

    if (draft.concepts.length > 0) {
      await deps.knowledgebaseRepository.mergeIngestionOutput({
        conceptEmbeddingsByKey: conceptEmbeddings.embeddingsByKey,
        output: draft,
        projectId: input.projectId,
        sourceId: input.sourceId,
      });
    }

    await deps.ingestionRunRepository.markCompleted(ingestionRun.id, {
      chunkCount: chunks.length,
      conceptCount: draft.concepts.length,
      droppedConceptKeys: totalDroppedConceptKeys,
      droppedRefCount: totalDroppedRefs,
      embedding: {
        concepts: conceptEmbeddings.metadata,
      },
      linking: linkingResult.result?.trace ?? null,
      relationshipCount: draft.relationships.length,
    });

    emit({ type: 'ingestion_complete', conceptCount: draft.concepts.length, relationshipCount: draft.relationships.length });
  } catch (error) {
    await deps.ingestionRunRepository.markFailed(
      ingestionRun.id,
      error instanceof Error ? error.message : 'ingestion_failed'
    );
    emit({ type: 'ingestion_failed', reason: error instanceof Error ? error.message : 'ingestion_failed' });
    throw error;
  }
}

async function retrieveExistingConceptContext(input: {
  blocks: string[];
  deps: ProjectDeps;
  emit: (event: IngestionStreamEvent) => void;
  projectId: string;
}): Promise<IngestionConceptContext[]> {
  const query = input.blocks.join('\n\n').slice(0, 1200).trim();

  if (!query) {
    return [];
  }

  const embedding = await embedQuery(query);
  const concepts = await input.deps.knowledgebaseRepository.searchConceptsForIngestion({
    embedding,
    limit: 3,
    projectId: input.projectId,
    query,
  });

  input.emit({
    type: 'retrieval_activity',
    hitCount: concepts.length,
    query,
    retrievalType: 'concept_search',
  });

  const rawContexts = await Promise.all(
    concepts.slice(0, 2).map(async (concept) => {
      const context = await input.deps.knowledgebaseRepository.getConceptContext({
        conceptKey: concept.conceptKey,
        projectId: input.projectId,
      });

      input.emit({
        type: 'retrieval_activity',
        hitCount: context?.neighbors.length ?? 0,
        query: concept.conceptKey,
        retrievalType: 'concept_neighbors',
      });

      return context;
    })
  );

  return rawContexts.filter((c): c is IngestionConceptContext => c !== null);
}

async function embedQuery(query: string) {
  if (!canUseEmbeddingModel(process.env)) {
    return undefined;
  }

  try {
    return await embedText(query);
  } catch {
    return undefined;
  }
}

async function embedConcepts(concepts: IngestionAgentOutput['concepts']) {
  if (!canUseEmbeddingModel(process.env) || !concepts.length) {
    return {
      embeddingsByKey: undefined,
      metadata: { status: 'skipped', reason: 'embedding_provider_not_configured' },
    };
  }

  try {
    const embeddings = await embedTexts(concepts.map(conceptEmbeddingText));
    const embeddingsByKey: Record<string, number[]> = {};

    concepts.forEach((concept, index) => {
      const key = concept.mergesWith ?? concept.conceptKey;
      const embedding = embeddings[index];
      if (embedding) {
        embeddingsByKey[key] = embedding;
      }
    });

    return {
      embeddingsByKey,
      metadata: { status: 'completed', embeddedConceptCount: Object.keys(embeddingsByKey).length },
    };
  } catch (error) {
    return {
      embeddingsByKey: undefined,
      metadata: {
        reason: error instanceof Error ? error.message : 'concept_embedding_failed',
        status: 'failed',
      },
    };
  }
}

function conceptEmbeddingText(concept: IngestionAgentOutput['concepts'][number]) {
  return `${concept.name}\n\n${concept.definition}`;
}
