import type { IngestionConceptContext } from '../knowledgebase';

export type ExistingConceptSearch = (input: {
  limit?: number;
  query: string;
}) => Promise<Array<{ conceptKey: string; definition: string; name: string }>>;

export type ExistingConceptContextLoader = (
  conceptKey: string
) => Promise<IngestionConceptContext | null>;
