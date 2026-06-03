import { createRefinementTools } from '@grasp/ai/refinement';
import type { KnowledgebaseRepository } from '@grasp/domain';

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

export function createFixtureRefinementTools(fixture: RefinementToolFixture = {}) {
  const repository = {
    searchConceptsForIngestion: async () =>
      (fixture.concepts ?? []).map((concept) => ({
        confidence: concept.confidence ?? 1,
        difficulty: concept.difficulty ?? 'beginner',
        evidenceCount: concept.evidenceCount ?? 0,
        ...concept,
      })),
  } as unknown as KnowledgebaseRepository;

  return createRefinementTools({
    knowledgebaseRepository: repository,
    projectId: 'eval-project',
  });
}

export function createRefinementToolOverrides(fixture: RefinementToolFixture = {}) {
  return {
    'search-wiki-concepts': async (_input: unknown) => {
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
