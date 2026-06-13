import { createTool } from '@mastra/core/tools';
import { v, requiredString } from '@grasp/domain';
import { LazyGraphRagClient } from '@grasp/lazy-graph-rag-client';

export function createLgsTools(client: LazyGraphRagClient) {
  const searchMaterialTool = createTool({
    id: 'search-material',
    description: 'Search indexed chunks and materials in the local knowledge base using Hybrid Search (Lexical + Vector).',
    inputSchema: v.object({
      collectionId: requiredString,
      tenantId: v.optional(v.string()),
      query: requiredString,
      topK: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20)), 5),
    }),
    outputSchema: v.object({
      results: v.array(v.object({
        chunk_id: v.string(),
        document_id: v.string(),
        source_id: v.string(),
        document_name: v.string(),
        content: v.string(),
        start_offset: v.number(),
        end_offset: v.number(),
        score: v.number(),
        lexical_rank: v.optional(v.nullish(v.number())),
        vector_rank: v.optional(v.nullish(v.number())),
      })),
      trace: v.object({
        lexical_count: v.number(),
        vector_count: v.number(),
        rrf_pool_size: v.number(),
        lexical_chunk_ids: v.optional(v.array(v.string())),
        vector_chunk_ids: v.optional(v.array(v.string())),
      }),
    }),
    execute: async ({ collectionId, tenantId, query, topK }) => 
      client.search({ collectionId, tenantId, query, topK }),
  });

  const getLocalGraphTool = createTool({
    id: 'get-local-graph',
    description: 'Get the local term co-occurrence graph for a collection. Contains extracted terms as nodes and chunk co-occurrences as edges.',
    inputSchema: v.object({
      collectionId: requiredString,
      tenantId: v.optional(v.string()),
      limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(500)), 100),
    }),
    outputSchema: v.object({
      nodes: v.array(v.any()),
      edges: v.array(v.any()),
    }),
    execute: async ({ collectionId, tenantId, limit }) => 
      client.getLocalGraph({ collectionId, tenantId, limit }),
  });

  const getChunkEvidenceTool = createTool({
    id: 'get-chunk-evidence',
    description: 'Fetch the original chunk text and metadata (evidence) using chunk IDs.',
    inputSchema: v.object({
      chunkIds: v.array(v.string()),
      tenantId: v.optional(v.string()),
    }),
    outputSchema: v.object({
      chunks: v.array(v.object({
        chunk_id: v.string(),
        document_id: v.string(),
        document_name: v.string(),
        source_type: v.string(),
        content: v.string(),
        start_offset: v.number(),
        end_offset: v.number(),
        chunk_index: v.number(),
      })),
    }),
    execute: async ({ chunkIds, tenantId }) => 
      client.getChunks({ chunkIds, tenantId }),
  });

  const indexSourceTool = createTool({
    id: 'index-source',
    description: 'Index a new source document into the local graph.',
    inputSchema: v.object({
      collectionId: requiredString,
      sourceId: requiredString,
      sourceType: v.picklist(['text', 'markdown']),
      documentName: requiredString,
      content: requiredString,
      tenantId: v.optional(v.string()),
    }),
    outputSchema: v.object({
      status: v.string(),
      documentId: v.optional(v.string()),
      chunkCount: v.number(),
      termCount: v.number(),
      chunkTermCount: v.number(),
      contentHash: v.string(),
    }),
    execute: async ({ collectionId, sourceId, sourceType, documentName, content, tenantId }) => 
      client.indexSource({ collectionId, sourceId, sourceType, documentName, content, tenantId }),
  });

  const deleteSourceTool = createTool({
    id: 'delete-source',
    description: 'Delete an indexed source document from LazyGraphRAG.',
    inputSchema: v.object({
      collectionId: requiredString,
      sourceId: requiredString,
      tenantId: v.optional(v.string()),
    }),
    outputSchema: v.object({
      status: v.literal('deleted'),
      deletedDocumentCount: v.number(),
    }),
    execute: async ({ collectionId, sourceId, tenantId }) =>
      client.deleteSource({ collectionId, sourceId, tenantId }),
  });

  return {
    searchMaterialTool,
    getLocalGraphTool,
    getChunkEvidenceTool,
    indexSourceTool,
    deleteSourceTool,
  };
}
