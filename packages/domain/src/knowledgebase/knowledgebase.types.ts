import type { KnowledgebaseArtifactContentDto } from './knowledgebase.dto';
import type { IngestionRunStatus } from '../constants';
import type { ConceptDifficultyDto } from '../concepts';
import type { IngestionAgentOutput } from '../ingestion';
import type { NormalizedSourceBlockDto } from '../sources';

export type IngestionRunRecord = {
  completedAt: Date | null;
  createdAt: Date;
  failureReason: string | null;
  id: string;
  metadata: unknown;
  projectId: string;
  sourceId: string | null;
  startedAt: Date;
  status: IngestionRunStatus;
  updatedAt: Date;
};

export type IngestionRunRepository = {
  create(input: {
    metadata?: unknown;
    projectId: string;
    sourceId?: string | null;
  }): Promise<IngestionRunRecord>;
  findLatestByProject(projectId: string): Promise<IngestionRunRecord | null>;
  markCompleted(
    ingestionRunId: string,
    metadata?: unknown
  ): Promise<IngestionRunRecord | null>;
  markFailed(
    ingestionRunId: string,
    failureReason: string,
    metadata?: unknown
  ): Promise<IngestionRunRecord | null>;
};

export type KnowledgebaseVersionRecord = {
  id: string;
  knowledgebaseId: string;
  versionNumber: number;
  createdAt: Date;
};

export type KnowledgebaseGraphConceptRecord = {
  id: string;
  name: string;
  definition: string;
  difficulty: ConceptDifficultyDto;
  confidence: string;
  sourceEvidence?: unknown;
  evidenceCount?: number;
};

export type KnowledgebaseGraphRelationshipRecord = {
  id: string;
  metadata: unknown;
  sourceConceptId: string;
  sourceEvidence?: unknown;
  evidenceCount?: number;
  targetConceptId: string;
  relationshipType: string;
};

export type KnowledgebaseGraphProjectionRecord = {
  concepts: KnowledgebaseGraphConceptRecord[];
  relationships: KnowledgebaseGraphRelationshipRecord[];
};

export type ExistingConceptSummary = {
  conceptKey: string;
  name: string;
  definition: string;
  difficulty: string;
  confidence: number;
};

export type IngestionConceptSearchResult = ExistingConceptSummary & {
  distance?: number;
  evidenceCount: number;
};

export type IngestionConceptEvidence = {
  blockId: string;
  excerpt: string;
  location: string;
  sourceId: string;
};

export type IngestionConceptNeighbor = {
  conceptKey: string;
  name: string;
  relationshipType: string;
  direction: 'incoming' | 'outgoing';
};

export type IngestionConceptContext = {
  concept: IngestionConceptSearchResult;
  evidence: IngestionConceptEvidence[];
  neighbors: IngestionConceptNeighbor[];
};
export type ConceptSearchPaginationInput = {
  projectId: string;
  query?: string;
  difficulty?: string;
  limit: number;
  offset: number;
};

export type ConceptSearchPaginationResult = {
  concepts: {
    id: string;
    name: string;
    definition: string;
    difficulty: 'advanced' | 'beginner' | 'intermediate';
    confidence: string;
    sourceEvidence?: unknown;
    evidenceCount?: number;
  }[];
  totalCount: number;
};

export type KnowledgebaseRepository = {
  findCurrentGraphByProject(projectId: string): Promise<KnowledgebaseGraphProjectionRecord | null>;
  findConceptEvidence(input: { conceptKey: string; projectId: string }): Promise<unknown[]>;
  findRelationshipEvidence(input: { projectId: string; relationshipKey: string }): Promise<unknown[]>;
  searchConceptsForIngestion(input: {
    embedding?: number[];
    limit?: number;
    projectId: string;
    query: string;
  }): Promise<IngestionConceptSearchResult[]>;
  getConceptContext(input: {
    conceptKey: string;
    projectId: string;
  }): Promise<IngestionConceptContext | null>;
  mergeIngestionOutput(input: {
    conceptEmbeddingsByKey?: Record<string, number[]>;
    output: IngestionAgentOutput;
    projectId: string;
    sourceId: string;
  }): Promise<KnowledgebaseVersionRecord>;
  upsertSourcePassages(input: {
    blocks: NormalizedSourceBlockDto[];
    projectId: string;
    sourceId: string;
  }): Promise<void>;
  cleanupDeletedSource(input: {
    projectId: string;
    sourceId: string;
  }): Promise<void>;
  replaceVersionFromContent(input: {
    content: KnowledgebaseArtifactContentDto;
    projectId: string;
  }): Promise<KnowledgebaseVersionRecord>;
  searchConceptsWithPagination(input: ConceptSearchPaginationInput): Promise<ConceptSearchPaginationResult>;
  
  addConcept(input: {
    projectId: string;
    conceptKey: string;
    name: string;
    definition: string;
    difficulty: string;
    confidence: number;
    metadata?: unknown;
  }): Promise<void>;
  updateConcept(input: {
    projectId: string;
    conceptKey: string;
    name?: string;
    definition?: string;
    difficulty?: string;
    confidence?: number;
    metadata?: unknown;
  }): Promise<void>;
  deleteConcept(input: {
    projectId: string;
    conceptKey: string;
  }): Promise<void>;
  addRelationship(input: {
    projectId: string;
    relationshipKey: string;
    sourceConceptKey: string;
    targetConceptKey: string;
    relationshipType: string;
    rationale?: string;
    metadata?: unknown;
  }): Promise<void>;
  deleteRelationship(input: {
    projectId: string;
    relationshipKey: string;
  }): Promise<void>;
  
  updateConceptEvidence(input: { projectId: string; evidenceId: string; quote?: string; locationLabel?: string; }): Promise<void>;

  deleteConceptEvidence(input: { projectId: string; evidenceId: string; }): Promise<void>;

  addConceptEvidence(input: {
    projectId: string;
    conceptKey: string;
    sourceType: 'web' | 'text';
    url?: string;
    title: string;
    quote: string;
    locationLabel: string;
  }): Promise<void>;

  createSnapshot(input: {
    projectId: string;
    trigger: string;
  }): Promise<KnowledgebaseVersionRecord | null>;
};
