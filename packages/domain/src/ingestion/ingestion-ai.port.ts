import type { IngestionAgentOutput, IngestionConcept } from './ingestion-agent.dto';
import type { SourceBlockForValidation } from './validate-source-refs';

export type ExtractChunkPortInput = {
  blocks: SourceBlockForValidation[];
  chunkIndex: number;
  draftConcepts: IngestionConcept[];
  draftRelationships: IngestionAgentOutput['relationships'];
  projectId: string;
  sourceId: string;
  totalChunks: number;
  onRetrieval?: (
    matches: number,
    queryOrKey: string,
    type: 'concept_search' | 'concept_neighbors'
  ) => void;
  onThinking?: (thinking: string) => void;
};

export type EmbedConceptsPortOutput =
  | { embeddingsByKey: undefined; metadata: { reason: string; status: 'skipped' | 'failed' } }
  | {
      embeddingsByKey: Record<string, number[]>;
      metadata: { embeddedConceptCount: number; status: 'completed' };
    };

export interface IngestionAiPort {
  embedConcepts(concepts: IngestionConcept[]): Promise<EmbedConceptsPortOutput>;
  extractConceptsFromChunk(
    input: ExtractChunkPortInput
  ): Promise<IngestionAgentOutput & { droppedConceptKeys: string[]; droppedRefCount: number }>;
}
