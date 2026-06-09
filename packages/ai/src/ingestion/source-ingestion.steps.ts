import { createStep } from '@mastra/core/workflows';
import {
  buildLinkCandidates,
  chunkNormalizedBlocks,
  mergeDraft,
  normalizeMarkdownSource,
  v,
  type IngestionAiPort,
  type IngestionRunRepository,
  type KnowledgebaseRepository,
} from '@grasp/domain';
import type { IngestionAgentOutput } from '@grasp/domain';
import { ingestionWorkflowInputSchema } from './source-ingestion.schema';
import { linkingWorkflowInputDto } from './source-linking.workflow';

export const ingestionStateSchema = v.object({
  projectId: v.optional(v.string()),
  sourceId: v.optional(v.string()),
  runId: v.optional(v.string()),
  chunkCount: v.optional(v.number()),
  totalDroppedRefs: v.optional(v.number(), 0),
  totalDroppedConceptKeys: v.optional(v.array(v.string()), []),
});

export const extractChunkOutputSchema = v.object({
  concepts: v.array(v.any()),
  droppedConceptKeys: v.array(v.string()),
  droppedRefCount: v.number(),
  relationClaims: v.array(v.any()),
  relationships: v.array(v.any()),
  thinking: v.optional(v.string(), ''),
});

function getDep<T>(ctx: { get(key: string): unknown } | undefined, key: string): T {
  const dep = ctx?.get(key);
  if (!dep) throw new Error(`${key} not found in request context`);
  return dep as T;
}

export const initializeRunStep = createStep({
  id: 'initialize-run',
  inputSchema: ingestionWorkflowInputSchema,
  outputSchema: v.object({
    content: v.string(),
    sourceTitle: v.string(),
  }),
  stateSchema: ingestionStateSchema,
  execute: async ({ inputData, requestContext, setState, state, writer }) => {
    const { ingestionRunId, projectId, sourceId, sourceTitle, content } = inputData;

    await setState({
      ...state,
      projectId,
      sourceId,
      runId: ingestionRunId,
      totalDroppedRefs: 0,
      totalDroppedConceptKeys: [],
    });

    await writer?.write({
      type: 'ingestion_started',
      sourceId,
      sourceTitle,
    });

    return { content, sourceTitle };
  },
});

export const normalizeAndChunkStep = createStep({
  id: 'normalize-and-chunk',
  inputSchema: v.object({
    content: v.string(),
    sourceTitle: v.string(),
  }),
  outputSchema: v.object({
    chunks: v.array(v.any()),
  }),
  stateSchema: ingestionStateSchema,
  execute: async ({ inputData, requestContext, state, setState }) => {
    const { content, sourceTitle } = inputData;

    if (!content.trim()) {
      await setState({ ...state, chunkCount: 0 });
      return { chunks: [] };
    }

    const normalized = normalizeMarkdownSource({
      sourceId: state.sourceId!,
      sourceMaterial: content,
      title: sourceTitle,
    });

    const kbRepo = getDep<KnowledgebaseRepository>(requestContext, 'knowledgebaseRepository');

    await kbRepo.upsertSourcePassages({
      blocks: normalized.blocks,
      projectId: state.projectId!,
      sourceId: state.sourceId!,
    });

    const chunks = chunkNormalizedBlocks(normalized.blocks);
    await setState({ ...state, chunkCount: chunks.length });

    return { chunks };
  },
});

export const extractChunkStep = createStep({
  id: 'extract-chunk',
  inputSchema: v.object({
    chunk: v.any(),
    totalChunks: v.number(),
  }),
  outputSchema: extractChunkOutputSchema,
  stateSchema: ingestionStateSchema,
  execute: async ({ inputData, requestContext, state, writer }) => {
    const { chunk, totalChunks } = inputData;
    const aiPort = getDep<IngestionAiPort>(requestContext, 'aiPort');

    const result = await aiPort.extractConceptsFromChunk({
      projectId: state.projectId!,
      sourceId: state.sourceId!,
      chunkIndex: chunk.chunkIndex,
      totalChunks,
      blocks: chunk.blocks || [],
      draftConcepts: [],
      draftRelationships: [],
      onRetrieval: (hitCount, query, retrievalType) => {
        if (writer) {
          writer
            .write({
              type: 'retrieval_activity',
              hitCount,
              query,
              retrievalType,
            })
            .catch(console.error);
        }
      },
      onThinking: (thinking) => {
        if (writer) {
          writer
            .write({
              type: 'agent_thinking',
              chunkIndex: chunk.chunkIndex,
              thinking,
            })
            .catch(console.error);
        }
      },
    });

    if (writer) {
      await writer.write({
        type: 'chunk_processing',
        chunkIndex: chunk.chunkIndex,
        totalChunks,
      });

      if (result.concepts) {
        for (const concept of result.concepts) {
          await writer.write({
            type: 'concept_extracted',
            conceptKey: concept.name,
            name: concept.name,
            isNew: true,
          });
        }
      }
    }

    return result;
  },
});

export const mergeExtractionsStep = createStep({
  id: 'merge-extractions',
  inputSchema: v.object({
    extractions: v.array(v.any()),
  }),
  outputSchema: v.object({
    draft: v.any(),
  }),
  stateSchema: ingestionStateSchema,
  execute: async ({ inputData, state, setState }) => {
    let draft: IngestionAgentOutput = { concepts: [], relationships: [], relationClaims: [] };
    let totalDroppedRefs = state.totalDroppedRefs || 0;
    const totalDroppedConceptKeys = state.totalDroppedConceptKeys
      ? [...state.totalDroppedConceptKeys]
      : [];

    for (const extraction of inputData.extractions) {
      if (extraction.concepts?.length) {
        draft = mergeDraft(draft, extraction);
      }
      totalDroppedRefs += extraction.droppedRefCount ?? 0;
      totalDroppedConceptKeys.push(...(extraction.droppedConceptKeys ?? []));
    }

    await setState({ ...state, totalDroppedRefs, totalDroppedConceptKeys });
    return { draft };
  },
});

export const prepareLinkCandidatesStep = createStep({
  id: 'prepare-link-candidates',
  inputSchema: v.object({
    draft: v.any(),
  }),
  outputSchema: linkingWorkflowInputDto,
  stateSchema: ingestionStateSchema,
  execute: async ({ inputData, requestContext, state }) => {
    const { draft } = inputData;
    const kbRepo = getDep<KnowledgebaseRepository>(requestContext, 'knowledgebaseRepository');
    const projectId = state.projectId!;

    const candidates = await buildLinkCandidates({
      getConceptContext: (conceptKey) => kbRepo.getConceptContext({ conceptKey, projectId }),
      localExtraction: draft,
      searchConcepts: async ({ query, limit }) => {
        return kbRepo.searchConceptsForIngestion({ limit, projectId, query });
      },
    });

    return {
      candidates,
      extraction: draft,
      useModel: true,
    };
  },
});

export const embedAndSaveStep = createStep({
  id: 'embed-and-save',
  inputSchema: v.object({
    patchedExtraction: v.any(),
    trace: v.any(),
  }),
  outputSchema: v.object({
    success: v.boolean(),
  }),
  stateSchema: ingestionStateSchema,
  execute: async ({ inputData, requestContext, state, writer }) => {
    const { patchedExtraction, trace } = inputData;

    const kbRepo = getDep<KnowledgebaseRepository>(requestContext, 'knowledgebaseRepository');
    const aiPort = getDep<IngestionAiPort>(requestContext, 'aiPort');
    const runRepo = getDep<IngestionRunRepository>(requestContext, 'ingestionRunRepository');

    const projectId = state.projectId!;
    const sourceId = state.sourceId!;

    const embeddingsResult = await aiPort.embedConcepts(patchedExtraction.concepts);

    await kbRepo.mergeIngestionOutput({
      conceptEmbeddingsByKey: embeddingsResult.embeddingsByKey,
      projectId,
      sourceId,
      output: patchedExtraction,
    });

    await runRepo.markCompleted(state.runId!, {
      chunkCount: state.chunkCount,
      conceptCount: patchedExtraction.concepts.length,
      droppedConceptKeys: state.totalDroppedConceptKeys,
      droppedRefCount: state.totalDroppedRefs,
      linking: trace,
      relationshipCount: patchedExtraction.relationships.length,
    });

    await writer?.write({
      type: 'ingestion_complete',
      conceptCount: patchedExtraction.concepts.length,
      relationshipCount: patchedExtraction.relationships.length,
    });

    return { success: true };
  },
});
