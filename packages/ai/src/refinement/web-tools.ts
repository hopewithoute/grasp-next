import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export function createSearchWebTool() {
  return createTool({
    id: 'search-web-ddg',
    description:
      'Search the internet via DuckDuckGo (or fallback to Wikipedia) for factual information or current events to augment concepts.',
    inputSchema: z.object({
      query: z.string().describe('The search query string'),
    }),
    execute: async ({ query }, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Checking web',
          detail: 'Looking up supporting information.',
          status: 'started',
        },
        transient: true,
      });

      let result;
      try {
        const { search, SafeSearchType } = await import('duck-duck-scrape');
        const searchResults = await search(query, { safeSearch: SafeSearchType.MODERATE });
        result = {
          results: searchResults.results.slice(0, 5).map((r) => ({
            title: r.title,
            description: r.description,
            url: r.url,
          })),
        };
      } catch (error) {
        console.warn('DDG Search failed, falling back to Wikipedia:', error);
        try {
          const wikiResponse = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`
          );
          const wikiData = await wikiResponse.json();
          if (wikiData.query && wikiData.query.search) {
            result = {
              results: wikiData.query.search
                .slice(0, 5)
                .map((r: { title: string; snippet: string }) => ({
                  title: r.title,
                  description: r.snippet.replace(/<[^>]*>?/gm, ''),
                  url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
                })),
            };
          } else {
            result = { error: 'Search engines are currently unavailable.' };
          }
        } catch (wikiError) {
          console.warn('Wiki Search failed:', wikiError);
          result = { error: 'Search engines are currently unavailable.' };
        }
      }

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Checked web',
          detail: 'Reviewed search results.',
          status: 'completed',
        },
        transient: true,
      });

      return result;
    },
  });
}

export function createProposeWebSourceTool() {
  return createTool({
    id: 'propose-web-source',
    description:
      'Propose a web page to be downloaded and added to the project library. You MUST use this tool to ask the user for permission before adding a source. The user will see a UI card with the URL, Title, and Snippet.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL of the webpage to ingest'),
      title: z.string().describe('A descriptive title for this source'),
      snippet: z.string().describe('A short summary snippet of what this source contains'),
    }),
    execute: async ({ url, title, snippet }, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Preparing source proposal',
          detail: 'Drafting web source addition for your review.',
          status: 'started',
        },
        transient: true,
      });

      await context?.writer?.custom({
        type: 'data-source-proposal',
        data: { url, title, snippet },
      });

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Source proposal ready',
          detail: 'Source proposal submitted for approval.',
          status: 'completed',
        },
        transient: true,
      });

      return {
        success: true,
        message: 'The web source proposal has been sent to the user. You must wait for the user to approve it. Do NOT proceed with extraction until the user approves and the system returns the extracted text to you.',
      };
    },
  });
}
