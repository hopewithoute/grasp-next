export const PROJECT_STATUS = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  REVIEWING: 'reviewing',
  PROCESSED: 'processed',
  FAILED: 'failed',
} as const;

export const PROJECT_STATUSES = [
  PROJECT_STATUS.DRAFT,
  PROJECT_STATUS.PROCESSING,
  PROJECT_STATUS.REVIEWING,
  PROJECT_STATUS.PROCESSED,
  PROJECT_STATUS.FAILED,
] as const;

export const PROJECT_SOURCE_TYPE = {
  MARKDOWN: 'markdown',
  TEXT: 'text',
  PDF: 'pdf',
  VIDEO: 'video',
  WEB: 'web',
} as const;

export const PROJECT_SOURCE_TYPES = [
  PROJECT_SOURCE_TYPE.MARKDOWN,
  PROJECT_SOURCE_TYPE.TEXT,
  PROJECT_SOURCE_TYPE.PDF,
  PROJECT_SOURCE_TYPE.VIDEO,
  PROJECT_SOURCE_TYPE.WEB,
] as const;

export const ARTIFACT_TYPE = {
  CONCEPT_GRAPH: 'concept_graph',
  LEARNING_OBJECTIVES: 'learning_objectives',
  LESSON_DRAFT: 'lesson_draft',
} as const;

export const ARTIFACT_TYPES = [
  ARTIFACT_TYPE.CONCEPT_GRAPH,
  ARTIFACT_TYPE.LEARNING_OBJECTIVES,
  ARTIFACT_TYPE.LESSON_DRAFT,
] as const;

export const ARTIFACT_STATUS = {
  PENDING: 'pending',
  GENERATING: 'generating',
  GENERATED: 'generated',
  NEEDS_REVISION: 'needs_revision',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  FAILED: 'failed',
} as const;

export const ARTIFACT_STATUSES = [
  ARTIFACT_STATUS.PENDING,
  ARTIFACT_STATUS.GENERATING,
  ARTIFACT_STATUS.GENERATED,
  ARTIFACT_STATUS.NEEDS_REVISION,
  ARTIFACT_STATUS.APPROVED,
  ARTIFACT_STATUS.PUBLISHED,
  ARTIFACT_STATUS.REJECTED,
  ARTIFACT_STATUS.FAILED,
] as const;

export const ARTIFACT_REVIEW_RUN_STATUS = {
  SUSPENDED: 'suspended',
  RESUMED: 'resumed',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const ARTIFACT_REVIEW_RUN_STATUSES = [
  ARTIFACT_REVIEW_RUN_STATUS.SUSPENDED,
  ARTIFACT_REVIEW_RUN_STATUS.RESUMED,
  ARTIFACT_REVIEW_RUN_STATUS.COMPLETED,
  ARTIFACT_REVIEW_RUN_STATUS.FAILED,
] as const;

export const EXTRACTION_MODE = {
  LLM_STRICT: 'llm_strict',
  LLM_JSON: 'llm_json',
} as const;

export const EXTRACTION_MODES = [
  EXTRACTION_MODE.LLM_STRICT,
  EXTRACTION_MODE.LLM_JSON,
] as const;

export const INGESTION_RUN_STATUS = {
  INGESTING: 'ingesting',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export const INGESTION_RUN_STATUSES = [
  INGESTION_RUN_STATUS.INGESTING,
  INGESTION_RUN_STATUS.COMPLETED,
  INGESTION_RUN_STATUS.FAILED,
] as const;

export const KNOWLEDGEBASE_VERSION_STATUS = {
  GENERATED: 'generated',
  APPROVED: 'approved',
  NEEDS_REVISION: 'needs_revision',
} as const;

export const KNOWLEDGEBASE_VERSION_STATUSES = [
  KNOWLEDGEBASE_VERSION_STATUS.GENERATED,
  KNOWLEDGEBASE_VERSION_STATUS.APPROVED,
  KNOWLEDGEBASE_VERSION_STATUS.NEEDS_REVISION,
] as const;

export const AUDIT_ENTITY_TYPE = {
  PROJECT: 'project',
  ARTIFACT: 'artifact',
} as const;

export const AUDIT_ACTION = {
  ARTIFACT_APPROVED: 'artifact.approved',
  ARTIFACT_KNOWLEDGEBASE_CONCEPT_UPDATED: 'artifact.knowledgebase_concept.updated',
  ARTIFACT_KNOWLEDGEBASE_EVIDENCE_UPDATED: 'artifact.knowledgebase_evidence.updated',
  ARTIFACT_KNOWLEDGEBASE_RELATIONSHIP_EVIDENCE_UPDATED:
    'artifact.knowledgebase_relationship_evidence.updated',
  ARTIFACT_KNOWLEDGEBASE_RELATIONSHIP_UPDATED: 'artifact.knowledgebase_relationship.updated',
  ARTIFACT_REVISION_REQUESTED: 'artifact.revision_requested',
  PROJECT_CREATED: 'project.created',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_DETAILS_UPDATED: 'project.details.updated',
  PROJECT_SOURCE_CREATED: 'project_source.created',
  PROJECT_SOURCE_DELETED: 'project_source.deleted',
  PROJECT_SOURCE_UPDATED: 'project_source.updated',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectSourceType = (typeof PROJECT_SOURCE_TYPES)[number];
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];
export type ArtifactReviewRunStatus = (typeof ARTIFACT_REVIEW_RUN_STATUSES)[number];
export type ExtractionMode = (typeof EXTRACTION_MODES)[number];
export type IngestionRunStatus = (typeof INGESTION_RUN_STATUSES)[number];
export type KnowledgebaseVersionStatus = (typeof KNOWLEDGEBASE_VERSION_STATUSES)[number];
