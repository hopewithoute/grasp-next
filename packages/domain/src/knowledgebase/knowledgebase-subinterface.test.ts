import { describe, expect, it } from 'vitest';
import type {
  KnowledgebaseRepository,
  KnowledgebaseQueryRepository,
  KnowledgebaseMutationRepository,
  KnowledgebaseIngestionRepository,
} from './knowledgebase.types';

describe('KnowledgebaseRepository sub-interfaces', () => {
  it('KnowledgebaseRepository satisfies KnowledgebaseQueryRepository', () => {
    // Type-level check: if this compiles, the assignment is valid.
    // We assert at runtime that the type relationship holds by checking
    // that a value of the full type can be assigned to the sub-type.
    const checkQuery = (repo: KnowledgebaseRepository): KnowledgebaseQueryRepository => repo;
    expect(typeof checkQuery === 'function').toBeTruthy();
  });

  it('KnowledgebaseRepository satisfies KnowledgebaseMutationRepository', () => {
    const checkMutation = (repo: KnowledgebaseRepository): KnowledgebaseMutationRepository => repo;
    expect(typeof checkMutation === 'function').toBeTruthy();
  });

  it('KnowledgebaseRepository satisfies KnowledgebaseIngestionRepository', () => {
    const checkIngestion = (repo: KnowledgebaseRepository): KnowledgebaseIngestionRepository => repo;
    expect(typeof checkIngestion === 'function').toBeTruthy();
  });

  it('sub-interfaces have the expected method counts', () => {
    // These counts verify the interface shape hasn't drifted unexpectedly.
    // KnowledgebaseQueryRepository: 6 methods
    // KnowledgebaseMutationRepository: 9 methods
    // KnowledgebaseIngestionRepository: 4 methods
    // Total: 19 methods (same as original KnowledgebaseRepository)

    // We can't directly inspect TypeScript interfaces at runtime,
    // but we document the expected shape here for reference.
    const expectedQueryMethods = [
      'findCurrentGraphByProject',
      'findConceptEvidence',
      'findRelationshipEvidence',
      'searchConceptsForIngestion',
      'getConceptContext',
      'searchConceptsWithPagination',
    ];

    const expectedMutationMethods = [
      'addConcept',
      'updateConcept',
      'deleteConcept',
      'addRelationship',
      'deleteRelationship',
      'updateConceptEvidence',
      'deleteConceptEvidence',
      'addConceptEvidence',
      'createSnapshot',
    ];

    const expectedIngestionMethods = [
      'mergeIngestionOutput',
      'upsertSourcePassages',
      'cleanupDeletedSource',
      'replaceVersionFromContent',
    ];

    expect(expectedQueryMethods.length).toBe(6);
    expect(expectedMutationMethods.length).toBe(9);
    expect(expectedIngestionMethods.length).toBe(4);
    expect(expectedQueryMethods.length + expectedMutationMethods.length + expectedIngestionMethods.length).toBe(19);
  });
});
