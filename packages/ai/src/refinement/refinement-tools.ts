import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { KnowledgebaseRepository } from '@grasp/domain';

export type RefinementDependencies = {
  knowledgebaseRepository: KnowledgebaseRepository;
  projectId: string;
};

export function createRefinementTools(deps: RefinementDependencies) {
  const searchWikiConceptsTool = createTool({
    id: 'search-wiki-concepts',
    description: 'Search existing knowledgebase concepts to find what currently exists.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(20).default(10),
      query: z.string().trim().min(1),
    }),
    outputSchema: z.object({
      concepts: z.array(
        z.object({
          conceptKey: z.string(),
          confidence: z.number(),
          definition: z.string(),
          difficulty: z.string(),
          evidenceCount: z.number(),
          name: z.string(),
        })
      ),
    }),
    execute: async ({ query, limit }) => {
      const concepts = await deps.knowledgebaseRepository.searchConceptsForIngestion({
        projectId: deps.projectId,
        query,
        limit,
      });
      return { concepts };
    },
  });

  const addConceptTool = createTool({
    id: 'add-concept',
    description: 'Add a new concept to the knowledge base.',
    inputSchema: z.object({
      conceptKey: z.string().describe('A unique, slugified identifier for the concept.'),
      name: z.string(),
      definition: z.string(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
      confidence: z.number().min(0).max(1),
    }),
    execute: async (input) => {
      await deps.knowledgebaseRepository.addConcept({
        projectId: deps.projectId,
        ...input,
      });
      return { success: true, message: `Concept ${input.conceptKey} added.` };
    },
  });

  const updateConceptTool = createTool({
    id: 'update-concept',
    description: 'Update an existing concept in the knowledge base.',
    inputSchema: z.object({
      conceptKey: z.string(),
      name: z.string().optional(),
      definition: z.string().optional(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      confidence: z.number().min(0).max(1).optional(),
    }),
    execute: async (input) => {
      await deps.knowledgebaseRepository.updateConcept({
        projectId: deps.projectId,
        ...input,
      });
      return { success: true, message: `Concept ${input.conceptKey} updated.` };
    },
  });

  const deleteConceptTool = createTool({
    id: 'delete-concept',
    description: 'Delete a concept from the knowledge base.',
    inputSchema: z.object({
      conceptKey: z.string(),
    }),
    execute: async ({ conceptKey }) => {
      await deps.knowledgebaseRepository.deleteConcept({
        projectId: deps.projectId,
        conceptKey,
      });
      return { success: true, message: `Concept ${conceptKey} deleted.` };
    },
  });

  const addRelationshipTool = createTool({
    id: 'add-relationship',
    description: 'Add a relationship between two existing concepts.',
    inputSchema: z.object({
      relationshipKey: z.string().describe('A unique identifier for this relationship (e.g. sourceKey-type-targetKey)'),
      sourceConceptKey: z.string(),
      targetConceptKey: z.string(),
      relationshipType: z.enum(['prerequisite', 'part_of', 'related_to', 'explains']),
      rationale: z.string().optional(),
    }),
    execute: async (input) => {
      await deps.knowledgebaseRepository.addRelationship({
        projectId: deps.projectId,
        ...input,
      });
      return { success: true, message: `Relationship ${input.relationshipKey} added.` };
    },
  });

  const deleteRelationshipTool = createTool({
    id: 'delete-relationship',
    description: 'Delete a relationship between two concepts.',
    inputSchema: z.object({
      relationshipKey: z.string(),
    }),
    execute: async ({ relationshipKey }) => {
      await deps.knowledgebaseRepository.deleteRelationship({
        projectId: deps.projectId,
        relationshipKey,
      });
      return { success: true, message: `Relationship ${relationshipKey} deleted.` };
    },
  });

  const searchWebTool = createTool({
    id: 'search-web-ddg',
    description: 'Search the internet via DuckDuckGo (or fallback to Wikipedia) for factual information or current events to augment concepts.',
    inputSchema: z.object({
      query: z.string().describe('The search query string'),
    }),
    execute: async ({ query }) => {
      try {
        // Import dynamically to avoid top-level issues if any
        const { search, SafeSearchType } = await import('duck-duck-scrape');
        const searchResults = await search(query, { safeSearch: SafeSearchType.MODERATE });
        
        return {
          results: searchResults.results.slice(0, 5).map(r => ({
            title: r.title,
            description: r.description,
            url: r.url
          }))
        };
      } catch (error) {
        console.warn('DDG Search failed, falling back to Wikipedia:', error);
        
        try {
          const wikiResponse = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`);
          const wikiData = await wikiResponse.json();
          if (wikiData.query && wikiData.query.search) {
             return {
               results: wikiData.query.search.slice(0, 5).map((r: { title: string; snippet: string }) => ({
                 title: r.title,
                 description: r.snippet.replace(/<[^>]*>?/gm, ''),
                 url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`
               }))
             };
          }
        } catch (wikiError) {
          console.warn('Wiki Search failed:', wikiError);
        }

        return {
          error: "Search engines are currently unavailable due to rate limits. Please inform the user or use alternative tools."
        };
      }
    },
  });

  const readWebpageTool = createTool({
    id: 'read-webpage',
    description: 'Fetch the text content of a given URL. Use this to read the full article of a search result URL.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL of the webpage to read'),
    }),
    execute: async ({ url }) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }
      const html = await response.text();
      
      const { compile } = await import('html-to-text');
      const convert = compile({ wordwrap: 130 });
      const text = convert(html);
      
      return { text: text.substring(0, 10000) }; // limit to 10k chars to avoid token explosion
    },
  });

  const addEvidenceTool = createTool({
    id: 'add-evidence',
    description: 'Add evidence to a concept from an external source (like a Web Search or a User Chat Correction).',
    inputSchema: z.object({
      conceptKey: z.string(),
      sourceType: z.enum(['web', 'text']).describe('Use "web" if the evidence comes from a URL, or "text" if it comes directly from a user chat message.'),
      url: z.string().url().optional().describe('Required if sourceType is web'),
      title: z.string().describe('Title of the source. For chat messages, you can just use "User Chat Correction".'),
      quote: z.string().describe('The exact quote or text that provides the evidence.'),
      locationLabel: z.string().describe('E.g. "Paragraph 1" or "Chat Message"'),
    }),
    execute: async (input) => {
      await deps.knowledgebaseRepository.addConceptEvidence({
        projectId: deps.projectId,
        ...input,
      });
      return { success: true, message: `Evidence added to concept ${input.conceptKey}.` };
    },
  });

  return {
    searchWikiConceptsTool,
    addConceptTool,
    updateConceptTool,
    deleteConceptTool,
    addRelationshipTool,
    deleteRelationshipTool,
    searchWebTool,
    readWebpageTool,
    addEvidenceTool,
  };
}
