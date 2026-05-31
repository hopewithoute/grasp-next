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

export function createReadWebpageTool() {
  return createTool({
    id: 'read-webpage',
    description:
      'Fetch the text content of a given URL. Use this to read the full article of a search result URL.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL of the webpage to read'),
    }),
    execute: async ({ url }, context) => {
      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Reading source',
          detail: 'Reviewing a web page for context.',
          status: 'started',
        },
        transient: true,
      });

      const response = await fetch(url);
      if (!response.ok) {
        await context?.writer?.custom({
          type: 'data-agent-activity',
          data: {
            type: 'agent_activity',
            label: 'Read source',
            detail: 'Reviewed a web page for context.',
            status: 'completed',
          },
          transient: true,
        });
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }
      const html = await response.text();
      const { compile } = await import('html-to-text');
      const convert = compile({ wordwrap: 130 });
      const text = convert(html);

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Read source',
          detail: 'Reviewed a web page for context.',
          status: 'completed',
        },
        transient: true,
      });

      return { text: text.substring(0, 10000) };
    },
  });
}

export function createAddWebSourceTool(deps: { onAddWebSource?: (url: string, title: string, text: string, skipIngestion?: boolean) => Promise<string> }) {
  return createTool({
    id: 'add-web-source-to-library',
    description:
      'Download a web page and add it to the project library as a permanent source. By default, this triggers background ingestion. Set skipBackgroundIngestion to true if you plan to manually extract and propose specific concepts right now.',
    inputSchema: z.object({
      url: z.string().url().describe('The URL of the webpage to ingest'),
      title: z.string().describe('A descriptive title for this source'),
      skipBackgroundIngestion: z.boolean().optional().describe('If true, saves the source but skips automatic concept extraction.'),
    }),
    execute: async ({ url, title, skipBackgroundIngestion }, context) => {
      if (!deps.onAddWebSource) {
        throw new Error('add-web-source-to-library tool is not supported in this environment (missing callback).');
      }

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Adding web source',
          detail: 'Downloading and saving article to library...',
          status: 'started',
        },
        transient: true,
      });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }
      const html = await response.text();
      const { compile } = await import('html-to-text');
      const convert = compile({ wordwrap: 130 });
      const text = convert(html);

      const sourceId = await deps.onAddWebSource(url, title, text, skipBackgroundIngestion);

      await context?.writer?.custom({
        type: 'data-agent-activity',
        data: {
          type: 'agent_activity',
          label: 'Added web source',
          detail: skipBackgroundIngestion ? 'Source saved. Skipping auto-ingestion.' : 'Source saved. Background ingestion started.',
          status: 'completed',
        },
        transient: true,
      });

      return {
        success: true,
        sourceId,
        message: skipBackgroundIngestion 
          ? 'The web page has been saved to the library. Automatic ingestion was skipped. You MUST now use propose-graph-changes to extract the specific information.'
          : 'The web page has been saved to the library and is currently being ingested in the background. The system will extract concepts from it automatically.',
      };
    },
  });
}
