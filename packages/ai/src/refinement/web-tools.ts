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
    execute: async ({ query }) => {
      try {
        const { search, SafeSearchType } = await import('duck-duck-scrape');
        const searchResults = await search(query, { safeSearch: SafeSearchType.MODERATE });
        return {
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
            return {
              results: wikiData.query.search
                .slice(0, 5)
                .map((r: { title: string; snippet: string }) => ({
                  title: r.title,
                  description: r.snippet.replace(/<[^>]*>?/gm, ''),
                  url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
                })),
            };
          }
        } catch (wikiError) {
          console.warn('Wiki Search failed:', wikiError);
        }
        return {
          error: 'Search engines are currently unavailable due to rate limits.',
        };
      }
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
    execute: async ({ url }) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }
      const html = await response.text();
      const { compile } = await import('html-to-text');
      const convert = compile({ wordwrap: 130 });
      const text = convert(html);
      return { text: text.substring(0, 10000) };
    },
  });
}
