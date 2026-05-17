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
  DETERMINISTIC: 'deterministic',
} as const;

export const EXTRACTION_MODES = [
  EXTRACTION_MODE.LLM_STRICT,
  EXTRACTION_MODE.LLM_JSON,
  EXTRACTION_MODE.DETERMINISTIC,
] as const;

export const CONCEPT_EXTRACTION_WORKFLOW = {
  ID: 'extract-concepts',
  REGISTRY_NAME: 'extractConceptsWorkflow',
  STEP_ID: 'extract-concepts',
  REVIEW_RESUME_LABEL: 'review_concepts',
  REVIEW_SUSPEND_REASON: 'review_concepts',
} as const;

export const AUDIT_ENTITY_TYPE = {
  PROJECT: 'project',
  ARTIFACT: 'artifact',
} as const;

export const AUDIT_ACTION = {
  ARTIFACT_APPROVED: 'artifact.approved',
  ARTIFACT_REVISION_REQUESTED: 'artifact.revision_requested',
  PROJECT_CREATED: 'project.created',
  PROJECT_CONCEPT_EXTRACTION_COMPLETED: 'project.concept_extraction.completed',
  PROJECT_CONCEPT_EXTRACTION_FAILED: 'project.concept_extraction.failed',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_DETAILS_UPDATED: 'project.details.updated',
  PROJECT_SOURCE_MATERIAL_SUBMITTED: 'project.source_material.submitted',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];
export type ArtifactReviewRunStatus = (typeof ARTIFACT_REVIEW_RUN_STATUSES)[number];
export type ExtractionMode = (typeof EXTRACTION_MODES)[number];
