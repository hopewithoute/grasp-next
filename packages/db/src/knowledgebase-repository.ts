import type { DbClient } from './client';
import type { KnowledgebaseRepository } from '@grasp/domain';

const removedMessage =
  'The legacy web database knowledgebase repository has been removed. Use the LazyGraphRAG service/client boundary instead.';

export type DbKnowledgebaseRepository = KnowledgebaseRepository;

export function createKnowledgebaseRepository(_db: DbClient): DbKnowledgebaseRepository {
  return new Proxy(
    {},
    {
      get() {
        return async () => {
          throw new Error(removedMessage);
        };
      },
    }
  ) as DbKnowledgebaseRepository;
}
