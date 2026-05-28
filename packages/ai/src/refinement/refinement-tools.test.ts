/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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

    assert.ok(tools['search-wiki-concepts']);
    assert.ok(tools['propose-graph-changes']);
    assert.ok(tools['search-web-ddg']);
    assert.ok(tools['read-webpage']);

    assert.equal('add-evidence' in tools, false);
    assert.equal('add-concept' in tools, false);
    assert.equal('update-concept' in tools, false);
    assert.equal('delete-concept' in tools, false);
    assert.equal('add-relationship' in tools, false);
    assert.equal('delete-relationship' in tools, false);
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

    assert.deepEqual(result, {
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

    assert.deepEqual(calls, [{ projectId: 'project-1', query: 'React', limit: 5 }]);
    assert.equal(result.concepts[0].conceptKey, 'react');
  });
});
