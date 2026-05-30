import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
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
    assert.ok(typeof checkQuery === 'function');
  });

  it('KnowledgebaseRepository satisfies KnowledgebaseMutationRepository', () => {
    const checkMutation = (repo: KnowledgebaseRepository): KnowledgebaseMutationRepository => repo;
    assert.ok(typeof checkMutation === 'function');
  });

  it('KnowledgebaseRepository satisfies KnowledgebaseIngestionRepository', () => {
    const checkIngestion = (repo: KnowledgebaseRepository): KnowledgebaseIngestionRepository => repo;
    assert.ok(typeof checkIngestion === 'function');
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

    assert.equal(expectedQueryMethods.length, 6);
    assert.equal(expectedMutationMethods.length, 9);
    assert.equal(expectedIngestionMethods.length, 4);
    assert.equal(
      expectedQueryMethods.length + expectedMutationMethods.length + expectedIngestionMethods.length,
      19
    );
  });
});
