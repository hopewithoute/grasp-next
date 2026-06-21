import { createRefinementTools } from '@grasp/ai/refinement';

export type RefinementToolFixture = {
  concepts?: Array<{
    conceptKey: string;
    confidence?: number;
    definition: string;
    difficulty?: string;
    evidenceCount?: number;
    name: string;
  }>;
  webpages?: Record<string, string>;
  webSearchResults?: Array<{
    description: string;
    title: string;
    url: string;
  }>;
};

export function createFixtureRefinementTools() {
  return createRefinementTools({
    projectId: 'eval-project',
    ownerId: 'eval-owner',
  });
}

export function createRefinementToolOverrides(fixture: RefinementToolFixture = {}) {
  return {
    'search-wiki-concepts': async () => {
      return { concepts: [] };
    },
    'search-web-ddg': async () => ({
      results: fixture.webSearchResults ?? [
        {
          title: 'React History Fixture',
          description: 'React was originally created by Facebook in 2013.',
          url: 'https://example.test/react-history',
        },
      ],
    }),
  };
}
