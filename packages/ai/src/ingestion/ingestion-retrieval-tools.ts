import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { IngestionConceptContext, IngestionConceptSearchResult } from '@grasp/domain';

export type IngestionRetrieval = {
  getConceptContext(conceptKey: string): Promise<IngestionConceptContext | null>;
  searchWikiConcepts(query: string, limit?: number): Promise<IngestionConceptSearchResult[]>;
};

export function createIngestionRetrievalTools(retrieval: IngestionRetrieval) {
  const searchWikiConceptsTool = createTool({
    id: 'search-wiki-concepts',
    description:
      'Search existing knowledgebase concepts before deciding whether a candidate concept is new or should reuse an existing conceptKey.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(10).default(5),
      query: z.string().trim().min(1),
    }),
    outputSchema: z.object({
      concepts: z.array(
        z.object({
          conceptKey: z.string(),
          confidence: z.number(),
          definition: z.string(),
          distance: z.number().optional(),
          difficulty: z.string(),
          evidenceCount: z.number(),
          name: z.string(),
        })
      ),
    }),
    execute: async ({ query, limit }) => {
      const concepts = await retrieval.searchWikiConcepts(query, limit);
      return { concepts };
    },
  });

  const getConceptContextTool = createTool({
    id: 'get-concept-context',
    description:
      'Load an existing concept with its evidence quotes and graph neighbors before proposing an update or relationship.',
    inputSchema: z.object({
      conceptKey: z.string().trim().min(1),
    }),
    outputSchema: z.object({
      context: z
        .object({
          concept: z.object({
            conceptKey: z.string(),
            confidence: z.number(),
            definition: z.string(),
            difficulty: z.string(),
            evidenceCount: z.number(),
            name: z.string(),
          }),
          evidence: z.array(
            z.object({
              blockId: z.string(),
              excerpt: z.string(),
              location: z.string(),
              sourceId: z.string(),
            })
          ),
          neighbors: z.array(
            z.object({
              conceptKey: z.string(),
              direction: z.enum(['incoming', 'outgoing']),
              name: z.string(),
              relationshipType: z.string(),
            })
          ),
        })
        .nullable(),
    }),
    execute: async ({ conceptKey }) => {
      const context = await retrieval.getConceptContext(conceptKey);
      return { context };
    },
  });

  const getConceptNeighborsTool = createTool({
    id: 'get-concept-neighbors',
    description:
      'Walk one graph hop from an existing concept and return incoming/outgoing neighboring concepts before proposing typed relationships.',
    inputSchema: z.object({
      conceptKey: z.string().trim().min(1),
    }),
    outputSchema: z.object({
      neighbors: z.array(
        z.object({
          conceptKey: z.string(),
          direction: z.enum(['incoming', 'outgoing']),
          name: z.string(),
          relationshipType: z.string(),
        })
      ),
    }),
    execute: async ({ conceptKey }) => {
      const context = await retrieval.getConceptContext(conceptKey);
      return { neighbors: context?.neighbors ?? [] };
    },
  });

  return {
    getConceptContextTool,
    getConceptNeighborsTool,
    searchWikiConceptsTool,
  };
}
