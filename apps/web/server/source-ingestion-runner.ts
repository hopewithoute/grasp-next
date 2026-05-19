import 'server-only';

import {
  chunkNormalizedBlocks,
  normalizeMarkdownSource,
  type IngestionAgentOutput,
} from '@grasp/domain';
import {
  createIngestionRetrievalTools,
  extractChunk,
  mergeDraft,
} from '@grasp/ai/ingestion';
import { canUseAgentModel } from '@grasp/ai/model-resolver';
import type { createProjectDeps } from './project-deps';

type ProjectDeps = ReturnType<typeof createProjectDeps>;

export type IngestionStreamEvent =
  | { type: 'ingestion_started'; sourceId: string; sourceTitle: string }
  | { type: 'chunk_processing'; chunkIndex: number; totalChunks: number }
  | { type: 'agent_thinking'; chunkIndex: number; thinking: string }
  | { type: 'concept_extracted'; conceptKey: string; name: string; isNew: boolean }
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

    if (!canUseAgentModel('ingestionAgent', process.env)) {
      throw new Error(
        'No LLM provider configured for ingestionAgent. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_COMPATIBLE_BASE_URL+OPENAI_COMPATIBLE_API_KEY before running ingestion.'
      );
    }

    const chunks = chunkNormalizedBlocks(normalized.blocks);
    let draft: IngestionAgentOutput = { concepts: [], relationships: [] };
    let totalDroppedRefs = 0;
    const totalDroppedConceptKeys: string[] = [];
    const retrievalTools = createIngestionRetrievalTools({
      getConceptContext: (conceptKey) =>
        deps.knowledgebaseRepository.getConceptContext({
          conceptKey,
          projectId: input.projectId,
        }),
      searchWikiConcepts: (query, limit) =>
        deps.knowledgebaseRepository.searchConceptsForIngestion({
          limit,
          projectId: input.projectId,
          query,
        }),
    });

    for (const chunk of chunks) {
      emit({ type: 'chunk_processing', chunkIndex: chunk.chunkIndex, totalChunks: chunks.length });

      const result = await extractChunk({
        blocks: chunk.blocks.map((block) => ({ id: block.id, text: block.text })),
        chunkIndex: chunk.chunkIndex,
        draftConcepts: draft.concepts,
        draftRelationships: draft.relationships,
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
        for (const c of result.concepts) {
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
        }
        for (const r of result.relationships) {
          emit({ type: 'relationship_extracted', source: r.sourceConceptKey, target: r.targetConceptKey });
        }
        draft = mergeDraft(draft, result);
      }
    }

    if (draft.concepts.length > 0) {
      await deps.knowledgebaseRepository.mergeIngestionOutput({
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
