/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import type { KnowledgebaseRepository } from '@grasp/domain';
import { createRefinementTools } from './refinement-tools';

const repository = {
  searchConceptsForIngestion: async () => [],
} as unknown as KnowledgebaseRepository;

describe('refinement tools contract', () => {
  it('exposes proposal and read tools without legacy direct mutation tools', () => {
    const tools = createRefinementTools({
      knowledgebaseRepository: repository,
      projectId: 'project-1',
    });

    expect(tools['search-wiki-concepts']).toBeTruthy();
    expect(tools['propose-graph-changes']).toBeTruthy();
    expect(tools['search-web-ddg']).toBeTruthy();
    expect(tools['read-webpage']).toBeTruthy();

    expect('add-evidence' in tools).toBe(false);
    expect('add-concept' in tools).toBe(false);
    expect('update-concept' in tools).toBe(false);
    expect('delete-concept' in tools).toBe(false);
    expect('add-relationship' in tools).toBe(false);
    expect('delete-relationship' in tools).toBe(false);
  });

  it('returns graph changes as an approval proposal instead of mutating directly', async () => {
    const tools = createRefinementTools({
      knowledgebaseRepository: repository,
      projectId: 'project-1',
    });

    const proposal = {
      rationale: 'Attach correction evidence to the existing React concept.',
      actions: [
        {
          type: 'add_evidence',
          payload: {
            conceptKey: 'react',
            evidenceText: 'React was originally created by Facebook in 2013.',
            rationale: 'This identifies the origin of React.',
            sourceType: 'text',
            title: 'User Chat Correction',
          },
        },
      ],
    };

    const result = await (tools['propose-graph-changes'] as any).execute(proposal, {} as any);

    expect(result).toEqual({
      status: 'proposal_submitted',
      proposal,
    });
  });

  it('searches concepts only through the project-scoped repository dependency', async () => {
    const calls: unknown[] = [];
    const tools = createRefinementTools({
      knowledgebaseRepository: {
        searchConceptsForIngestion: async (input: unknown) => {
          calls.push(input);
          return [
            {
              conceptKey: 'react',
              name: 'React',
              definition: 'A UI library.',
              difficulty: 'beginner',
              confidence: 1,
              evidenceCount: 0,
            },
          ];
        },
      } as unknown as KnowledgebaseRepository,
      projectId: 'project-1',
    });

    const result = await (tools['search-wiki-concepts'] as any).execute(
      { query: 'React', limit: 5 },
      {} as any
    );

    expect(calls).toEqual([{ projectId: 'project-1', query: 'React', limit: 5 }]);
    expect(result.concepts[0].conceptKey).toBe('react');
  });
});
