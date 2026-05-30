import type { IngestionAgentOutput, IngestionConcept, IngestionRelationship } from './ingestion-agent.dto';
import type { LinkCandidate, ReviewedLink, LinkPolicyResult, LinkTrace } from './linking';
import type { SourceBlockForValidation } from './validate-source-refs';

export interface ExtractChunkPortInput {
  projectId: string;
  sourceId: string;
  chunkIndex: number;
  totalChunks: number;
  blocks: SourceBlockForValidation[];
  draftConcepts: IngestionConcept[];
  draftRelationships: IngestionRelationship[];
  onThinking?: (thinking: string) => void;
  onRetrieval?: (hitCount: number, query: string, type: 'concept_search' | 'concept_neighbors') => void;
}

export interface EvaluateLinkCandidatesPortInput {
  projectId: string;
  extraction: IngestionAgentOutput;
  candidates: LinkCandidate[];
}

export interface EvaluateLinkCandidatesPortOutput {
  reviewedLinks: ReviewedLink[];
  policyResults: LinkPolicyResult[];
  acceptedLinks: ReviewedLink[];
  rejectedLinks: ReviewedLink[];
  patchedExtraction: IngestionAgentOutput;
  trace: LinkTrace;
}

export interface IngestionAiPort {
  extractConceptsFromChunk(input: ExtractChunkPortInput): Promise<IngestionAgentOutput & { droppedConceptKeys: string[]; droppedRefCount: number; }>;
  evaluateLinkCandidates(input: EvaluateLinkCandidatesPortInput): Promise<EvaluateLinkCandidatesPortOutput>;
  embedConcepts(concepts: IngestionConcept[]): Promise<{ embeddingsByKey?: Record<string, number[]>; metadata: Record<string, unknown> }>;
}
