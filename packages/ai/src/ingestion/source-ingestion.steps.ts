import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { ingestionWorkflowInputSchema } from './source-ingestion.schema';
import type { IngestionRunRepository, KnowledgebaseRepository, IngestionAiPort } from '@grasp/domain';
import { normalizeMarkdownSource, chunkNormalizedBlocks, mergeDraft, buildLinkCandidates } from '@grasp/domain';
import type { IngestionAgentOutput } from '@grasp/domain';

export const ingestionStateSchema = z.object({
  projectId: z.string().optional(),
  sourceId: z.string().optional(),
  runId: z.string().optional(),
  chunkCount: z.number().optional(),
  totalDroppedRefs: z.number().default(0),
  totalDroppedConceptKeys: z.array(z.string()).default([]),
});

function getDep<T>(ctx: { get(key: string): unknown } | undefined, key: string): T {
  const dep = ctx?.get(key);
  if (!dep) throw new Error(`${key} not found in request context`);
  return dep as T;
}

export const initializeRunStep = createStep({
  id: 'initialize-run',
  inputSchema: ingestionWorkflowInputSchema,
  outputSchema: z.object({
    content: z.string(),
    sourceTitle: z.string(),
  }),
  stateSchema: ingestionStateSchema,
  execute: async ({ inputData, requestContext, setState, state, writer }) => {
    const { projectId, sourceId, sourceTitle, content } = inputData;
    const repo = getDep<IngestionRunRepository>(requestContext, 'ingestionRunRepository');

    const ingestionRun = await repo.create({ projectId, sourceId });

    await setState({ 
      ...state,
      projectId, 
      sourceId, 
      runId: ingestionRun.id,
      totalDroppedRefs: 0,
      totalDroppedConceptKeys: []
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
  inputSchema: z.object({
    content: z.string(),
    sourceTitle: z.string(),
  }),
  outputSchema: z.object({
    chunks: z.array(z.any()),
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
  inputSchema: z.object({
    chunk: z.any(),
    totalChunks: z.number(),
  }),
  outputSchema: z.any(),
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
          writer.write({
            type: 'retrieval_activity',
            hitCount,
            query,
            retrievalType,
          }).catch(console.error);
        }
      },
      onThinking: (thinking) => {
        if (writer) {
          writer.write({
            type: 'agent_thinking',
            chunkIndex: chunk.chunkIndex,
            thinking,
          }).catch(console.error);
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
  inputSchema: z.object({
    extractions: z.array(z.any()),
  }),
  outputSchema: z.object({
    draft: z.any(),
  }),
  stateSchema: ingestionStateSchema,
  execute: async ({ inputData, state, setState }) => {
    let draft: IngestionAgentOutput = { concepts: [], relationships: [], relationClaims: [] };
    let totalDroppedRefs = state.totalDroppedRefs || 0;
    const totalDroppedConceptKeys = state.totalDroppedConceptKeys ? [...state.totalDroppedConceptKeys] : [];
    
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

import { linkingWorkflowInputDto } from './source-linking.workflow';

export const prepareLinkCandidatesStep = createStep({
  id: 'prepare-link-candidates',
  inputSchema: z.object({
    draft: z.any(),
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
  inputSchema: z.object({
    patchedExtraction: z.any(),
    trace: z.any(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
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



