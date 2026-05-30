import { describe, expect, it } from 'vitest';
import { applyGraphProposals, type GraphProposalAction } from './apply-graph-proposals.action';
import type { KnowledgebaseRepository } from '../knowledgebase/knowledgebase.types';

type MockCall = { method: string; args: unknown[] };

function createMockRepository(): KnowledgebaseRepository & { calls: MockCall[] } {
  const calls: MockCall[] = [];

  return {
    calls,
    findCurrentGraphByProject: async () => null,
    findConceptEvidence: async () => [],
    findRelationshipEvidence: async () => [],
    searchConceptsForIngestion: async () => [],
    getConceptContext: async () => null,
    mergeIngestionOutput: async () => ({
      id: 'v1',
      knowledgebaseId: 'kb1',
      versionNumber: 1,
      createdAt: new Date(),
    }),
    upsertSourcePassages: async () => {},
    cleanupDeletedSource: async () => {},
    replaceVersionFromContent: async () => ({
      id: 'v1',
      knowledgebaseId: 'kb1',
      versionNumber: 1,
      createdAt: new Date(),
    }),
    searchConceptsWithPagination: async () => ({ concepts: [], totalCount: 0 }),
    addConcept: async (input) => {
      calls.push({ method: 'addConcept', args: [input] });
    },
    updateConcept: async (input) => {
      calls.push({ method: 'updateConcept', args: [input] });
    },
    deleteConcept: async (input) => {
      calls.push({ method: 'deleteConcept', args: [input] });
    },
    addRelationship: async (input) => {
      calls.push({ method: 'addRelationship', args: [input] });
    },
    deleteRelationship: async (input) => {
      calls.push({ method: 'deleteRelationship', args: [input] });
    },
    updateConceptEvidence: async (input) => {
      calls.push({ method: 'updateConceptEvidence', args: [input] });
    },
    deleteConceptEvidence: async (input) => {
      calls.push({ method: 'deleteConceptEvidence', args: [input] });
    },
    addConceptEvidence: async (input) => {
      calls.push({ method: 'addConceptEvidence', args: [input] });
    },
    createSnapshot: async (input) => {
      calls.push({ method: 'createSnapshot', args: [input] });
      return { id: 'v1', knowledgebaseId: 'kb1', versionNumber: 1, createdAt: new Date() };
    },
  };
}

describe('applyGraphProposals', () => {
  it('applies add_concept action', async () => {
    const repo = createMockRepository();
    const actions: GraphProposalAction[] = [
      {
        type: 'add_concept',
        payload: {
          conceptKey: 'momentum',
          name: 'Momentum',
          definition: 'Mass times velocity.',
          difficulty: 'intermediate',
          confidence: 0.85,
        },
      },
    ];

    const result = await applyGraphProposals(
      { projectId: 'p1', actions },
      { knowledgebaseRepository: repo }
    );

    expect(result.success).toBe(true);
    expect(result.applied).toBe(1);
    expect(repo.calls.length).toBe(2); // addConcept + createSnapshot
    expect(repo.calls[0]?.method).toBe('addConcept');
  });

  it('applies delete_concept action', async () => {
    const repo = createMockRepository();
    const actions: GraphProposalAction[] = [
      {
        type: 'delete_concept',
        payload: { conceptKey: 'force' },
      },
    ];

    await applyGraphProposals(
      { projectId: 'p1', actions },
      { knowledgebaseRepository: repo }
    );

    expect(repo.calls[0]?.method).toBe('deleteConcept');
  });

  it('applies add_relationship action', async () => {
    const repo = createMockRepository();
    const actions: GraphProposalAction[] = [
      {
        type: 'add_relationship',
        payload: {
          sourceConceptKey: 'c1',
          targetConceptKey: 'c2',
          relationshipType: 'prerequisite',
        },
      },
    ];

    await applyGraphProposals(
      { projectId: 'p1', actions },
      { knowledgebaseRepository: repo }
    );

    expect(repo.calls[0]?.method).toBe('addRelationship');
  });

  it('applies add_evidence action', async () => {
    const repo = createMockRepository();
    const actions: GraphProposalAction[] = [
      {
        type: 'add_evidence',
        payload: {
          conceptKey: 'force',
          evidenceText: 'Force changes motion.',
          sourceType: 'text',
        },
      },
    ];

    await applyGraphProposals(
      { projectId: 'p1', actions },
      { knowledgebaseRepository: repo }
    );

    expect(repo.calls[0]?.method).toBe('addConceptEvidence');
  });

  it('always creates a snapshot after applying', async () => {
    const repo = createMockRepository();
    const actions: GraphProposalAction[] = [
      {
        type: 'add_concept',
        payload: {
          conceptKey: 'test',
          name: 'Test',
          definition: 'Test concept.',
          difficulty: 'beginner',
          confidence: 0.5,
        },
      },
    ];

    await applyGraphProposals(
      { projectId: 'p1', actions },
      { knowledgebaseRepository: repo }
    );

    const snapshotCall = repo.calls.find((c) => c.method === 'createSnapshot');
    expect(snapshotCall).toBeTruthy();
  });

  it('throws on unknown action type', async () => {
    const repo = createMockRepository();
    const actions: GraphProposalAction[] = [
      { type: 'unknown_action', payload: {} },
    ];

    await expect(() =>
        applyGraphProposals(
          { projectId: 'p1', actions },
          { knowledgebaseRepository: repo }
        )).rejects.toThrow('Unknown action type: unknown_action');
  });

  it('handles multiple actions in sequence', async () => {
    const repo = createMockRepository();
    const actions: GraphProposalAction[] = [
      {
        type: 'add_concept',
        payload: {
          conceptKey: 'c1',
          name: 'Concept 1',
          definition: 'First.',
          difficulty: 'beginner',
          confidence: 0.9,
        },
      },
      {
        type: 'add_concept',
        payload: {
          conceptKey: 'c2',
          name: 'Concept 2',
          definition: 'Second.',
          difficulty: 'intermediate',
          confidence: 0.8,
        },
      },
      {
        type: 'add_relationship',
        payload: {
          sourceConceptKey: 'c1',
          targetConceptKey: 'c2',
          relationshipType: 'prerequisite',
        },
      },
    ];

    const result = await applyGraphProposals(
      { projectId: 'p1', actions },
      { knowledgebaseRepository: repo }
    );

    expect(result.applied).toBe(3);
    // 2 addConcept + 1 addRelationship + 1 createSnapshot = 4 calls
    expect(repo.calls.length).toBe(4);
  });
});
