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
  sourceEvidence: unknown;
};

export type KnowledgebaseGraphRelationshipRecord = {
  id: string;
  sourceConceptId: string;
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

export type KnowledgebaseRepository = {
  findCurrentGraphByProject(projectId: string): Promise<KnowledgebaseGraphProjectionRecord | null>;
  searchConceptsForIngestion(input: {
    limit?: number;
    projectId: string;
    query: string;
  }): Promise<IngestionConceptSearchResult[]>;
  getConceptContext(input: {
    conceptKey: string;
    projectId: string;
  }): Promise<IngestionConceptContext | null>;
  mergeIngestionOutput(input: {
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
};
