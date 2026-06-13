import { createTool } from '@mastra/core/tools';
import {
  requiredString,
  v,
  type IngestionConceptContext,
  type IngestionConceptSearchResult,
} from '@grasp/domain';

export type IngestionRetrieval = {
  getConceptContext(conceptKey: string): Promise<IngestionConceptContext | null>;
  searchWikiConcepts(query: string, limit?: number): Promise<IngestionConceptSearchResult[]>;
};

export function createIngestionRetrievalTools(retrieval: IngestionRetrieval) {
  const searchWikiConceptsTool = createTool({
    id: 'search-wiki-concepts',
    description:
      'Search existing knowledgebase concepts before deciding whether a candidate concept is new or should reuse an existing conceptKey.',
    inputSchema: v.object({
      limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10)), 5),
      query: requiredString,
    }),
    outputSchema: v.object({
      concepts: v.array(
        v.object({
          conceptKey: v.string(),
          confidence: v.number(),
          definition: v.string(),
          distance: v.optional(v.number()),
          difficulty: v.string(),
          evidenceCount: v.number(),
          name: v.string(),
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
    inputSchema: v.object({
      conceptKey: requiredString,
    }),
    outputSchema: v.object({
      context: v.nullable(
        v.object({
          concept: v.object({
            conceptKey: v.string(),
            confidence: v.number(),
            definition: v.string(),
            difficulty: v.string(),
            evidenceCount: v.number(),
            name: v.string(),
          }),
          evidence: v.array(
            v.object({
              blockId: v.string(),
              excerpt: v.string(),
              location: v.string(),
              sourceId: v.string(),
            })
          ),
          neighbors: v.array(
            v.object({
              conceptKey: v.string(),
              direction: v.picklist(['incoming', 'outgoing']),
              name: v.string(),
              relationshipType: v.string(),
            })
          ),
        })
      ),
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
    inputSchema: v.object({
      conceptKey: requiredString,
    }),
    outputSchema: v.object({
      neighbors: v.array(
        v.object({
          conceptKey: v.string(),
          direction: v.picklist(['incoming', 'outgoing']),
          name: v.string(),
          relationshipType: v.string(),
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
