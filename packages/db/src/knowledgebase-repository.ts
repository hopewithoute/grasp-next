import type { KnowledgebaseRepository } from '@grasp/domain';
import type { DbClient } from './client';
import { createKnowledgebaseQueryMethods } from './knowledgebase-query-repo';
import { createKnowledgebaseMutationMethods } from './knowledgebase-mutation-repo';
import { createKnowledgebaseIngestionMethods } from './knowledgebase-ingestion-repo';

export type DbKnowledgebaseRepository = ReturnType<typeof createKnowledgebaseRepository>;

/**
 * Composes the three sub-repositories (query, mutation, ingestion) into a
 * single KnowledgebaseRepository. Callers that need a narrower surface can
 * import the sub-module directly.
 */
export function createKnowledgebaseRepository(db: DbClient): KnowledgebaseRepository {
  return {
    ...createKnowledgebaseQueryMethods(db),
    ...createKnowledgebaseMutationMethods(db),
    ...createKnowledgebaseIngestionMethods(db),
  };
}
