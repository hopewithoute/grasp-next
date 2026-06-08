import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import {
  ARTIFACT_REVIEW_RUN_STATUS,
  ARTIFACT_REVIEW_RUN_STATUSES,
  ARTIFACT_STATUS,
  ARTIFACT_STATUSES,
  ARTIFACT_TYPES,
  EXTRACTION_MODE,
  INGESTION_RUN_STATUS,
  INGESTION_RUN_STATUSES,
  KNOWLEDGEBASE_VERSION_STATUS,
  KNOWLEDGEBASE_VERSION_STATUSES,
  PROJECT_SOURCE_TYPES,
  PROJECT_STATUS,
  PROJECT_STATUSES,
} from '@grasp/domain';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    withTimezone: true,
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const projectStatus = pgEnum('project_status', PROJECT_STATUSES);

export const projectSourceType = pgEnum('project_source_type', PROJECT_SOURCE_TYPES);

export const ingestionRunStatus = pgEnum('ingestion_run_status', INGESTION_RUN_STATUSES);

export const knowledgebaseVersionStatus = pgEnum(
  'knowledgebase_version_status',
  KNOWLEDGEBASE_VERSION_STATUSES
);

export const artifactType = pgEnum('artifact_type', ARTIFACT_TYPES);

export const artifactStatus = pgEnum('artifact_status', ARTIFACT_STATUSES);

export const artifactReviewRunStatus = pgEnum(
  'artifact_review_run_status',
  ARTIFACT_REVIEW_RUN_STATUSES
);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: projectStatus('status').notNull().default(PROJECT_STATUS.DRAFT),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectSources = pgTable('project_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  type: projectSourceType('type').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  fileRef: text('file_ref'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sourcePassages = pgTable(
  'source_passages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id')
      .notNull()
      .references(() => projectSources.id, { onDelete: 'cascade' }),
    blockId: text('block_id').notNull(),
    kind: text('kind').notNull(),
    text: text('text').notNull(),
    location: jsonb('location').notNull(),
    metadata: jsonb('metadata'),
    order: integer('order').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('source_passages_project_idx').on(table.projectId),
    uniqueIndex('source_passages_source_block_unique').on(table.sourceId, table.blockId),
  ]
);

export const ingestionRuns = pgTable(
  'ingestion_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id').references(() => projectSources.id, { onDelete: 'set null' }),
    status: ingestionRunStatus('status').notNull().default(INGESTION_RUN_STATUS.INGESTING),
    failureReason: text('failure_reason'),
    metadata: jsonb('metadata'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ingestion_runs_project_idx').on(table.projectId)]
);

export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    type: artifactType('type').notNull(),
    status: artifactStatus('status').notNull().default(ARTIFACT_STATUS.PENDING),
    currentVersionId: uuid('current_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('artifacts_project_type_unique').on(table.projectId, table.type)]
);

export const artifactVersions = pgTable(
  'artifact_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    artifactId: uuid('artifact_id')
      .notNull()
      .references(() => artifacts.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    content: jsonb('content').notNull(),
    revisionFeedback: text('revision_feedback'),
    extractionMode: text('extraction_mode').notNull().default(EXTRACTION_MODE.LLM_JSON),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('artifact_versions_artifact_version_unique').on(
      table.artifactId,
      table.versionNumber
    ),
  ]
);

export const knowledgebases = pgTable(
  'knowledgebases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    artifactId: uuid('artifact_id').references(() => artifacts.id, { onDelete: 'set null' }),
    currentVersionId: uuid('current_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('knowledgebases_project_unique').on(table.projectId)]
);

export const knowledgebaseVersions = pgTable(
  'knowledgebase_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    knowledgebaseId: uuid('knowledgebase_id')
      .notNull()
      .references(() => knowledgebases.id, { onDelete: 'cascade' }),
    artifactVersionId: uuid('artifact_version_id').references(() => artifactVersions.id, {
      onDelete: 'set null',
    }),
    versionNumber: integer('version_number').notNull(),
    status: knowledgebaseVersionStatus('status')
      .notNull()
      .default(KNOWLEDGEBASE_VERSION_STATUS.GENERATED),
    snapshot: jsonb('snapshot').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('knowledgebase_versions_version_unique').on(
      table.knowledgebaseId,
      table.versionNumber
    ),
  ]
);

export const wikiConcepts = pgTable(
  'wiki_concepts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    knowledgebaseId: uuid('knowledgebase_id')
      .notNull()
      .references(() => knowledgebases.id, { onDelete: 'cascade' }),
    knowledgebaseVersionId: uuid('knowledgebase_version_id').references(
      () => knowledgebaseVersions.id,
      { onDelete: 'cascade' }
    ),
    conceptKey: text('concept_key').notNull(),
    name: text('name').notNull(),
    definition: text('definition').notNull(),
    difficulty: text('difficulty').notNull(),
    confidence: real('confidence').notNull(),
    metadata: jsonb('metadata'),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('wiki_concepts_knowledgebase_idx').on(table.knowledgebaseId),
    uniqueIndex('wiki_concepts_kb_key_unique').on(table.knowledgebaseId, table.conceptKey),
    index('wiki_concepts_name_trgm_idx').using('gin', sql`${table.name} gin_trgm_ops`),
    index('wiki_concepts_def_trgm_idx').using('gin', sql`${table.definition} gin_trgm_ops`),
  ]
);

export const wikiRelationships = pgTable(
  'wiki_relationships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    knowledgebaseId: uuid('knowledgebase_id')
      .notNull()
      .references(() => knowledgebases.id, { onDelete: 'cascade' }),
    knowledgebaseVersionId: uuid('knowledgebase_version_id').references(
      () => knowledgebaseVersions.id,
      { onDelete: 'cascade' }
    ),
    relationshipKey: text('relationship_key').notNull(),
    sourceConceptId: uuid('source_concept_id')
      .notNull()
      .references(() => wikiConcepts.id, { onDelete: 'cascade' }),
    targetConceptId: uuid('target_concept_id')
      .notNull()
      .references(() => wikiConcepts.id, { onDelete: 'cascade' }),
    relationshipType: text('relationship_type').notNull(),
    rationale: text('rationale'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('wiki_relationships_knowledgebase_idx').on(table.knowledgebaseId),
    uniqueIndex('wiki_relationships_kb_key_unique').on(
      table.knowledgebaseId,
      table.relationshipKey
    ),
  ]
);

export const wikiConceptSourceRefs = pgTable(
  'wiki_concept_source_refs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conceptId: uuid('concept_id')
      .notNull()
      .references(() => wikiConcepts.id, { onDelete: 'cascade' }),
    sourcePassageId: uuid('source_passage_id')
      .notNull()
      .references(() => sourcePassages.id, { onDelete: 'cascade' }),
    quote: text('quote').notNull(),
    locationLabel: text('location_label').notNull(),
  },
  (table) => [
    index('wiki_concept_refs_quote_trgm_idx').using('gin', sql`${table.quote} gin_trgm_ops`),
  ]
);

export const wikiRelationshipSourceRefs = pgTable('wiki_relationship_source_refs', {
  id: uuid('id').primaryKey().defaultRandom(),
  relationshipId: uuid('relationship_id')
    .notNull()
    .references(() => wikiRelationships.id, { onDelete: 'cascade' }),
  sourcePassageId: uuid('source_passage_id')
    .notNull()
    .references(() => sourcePassages.id, { onDelete: 'cascade' }),
  quote: text('quote').notNull(),
  locationLabel: text('location_label').notNull(),
});

export const artifactReviewRuns = pgTable(
  'artifact_review_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    artifactId: uuid('artifact_id')
      .notNull()
      .references(() => artifacts.id, { onDelete: 'cascade' }),
    artifactVersionId: uuid('artifact_version_id')
      .notNull()
      .references(() => artifactVersions.id, { onDelete: 'cascade' }),
    workflowId: text('workflow_id').notNull(),
    workflowRunId: text('workflow_run_id').notNull(),
    resumeLabel: text('resume_label').notNull(),
    suspendedSteps: jsonb('suspended_steps').notNull(),
    resumeLabels: jsonb('resume_labels'),
    status: artifactReviewRunStatus('status')
      .notNull()
      .default(ARTIFACT_REVIEW_RUN_STATUS.SUSPENDED),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('artifact_review_runs_artifact_version_unique').on(table.artifactVersionId),
  ]
);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  account,
  artifactVersions,
  artifactReviewRuns,
  artifacts,
  auditLogs,
  ingestionRuns,
  knowledgebaseVersions,
  knowledgebases,
  projects,
  projectSources,
  session,
  sourcePassages,
  user,
  verification,
  wikiConceptSourceRefs,
  wikiConcepts,
  wikiRelationshipSourceRefs,
  wikiRelationships,
};

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Artifact = typeof artifacts.$inferSelect;
export type ArtifactReviewRun = typeof artifactReviewRuns.$inferSelect;
export type ArtifactVersion = typeof artifactVersions.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;
export type NewArtifactReviewRun = typeof artifactReviewRuns.$inferInsert;
export type NewArtifactVersion = typeof artifactVersions.$inferInsert;
export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type Knowledgebase = typeof knowledgebases.$inferSelect;
export type KnowledgebaseVersion = typeof knowledgebaseVersions.$inferSelect;
export type NewIngestionRun = typeof ingestionRuns.$inferInsert;
export type NewKnowledgebase = typeof knowledgebases.$inferInsert;
export type NewKnowledgebaseVersion = typeof knowledgebaseVersions.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectSource = typeof projectSources.$inferSelect;
export type NewProjectSource = typeof projectSources.$inferInsert;
export type SourcePassage = typeof sourcePassages.$inferSelect;
export type NewSourcePassage = typeof sourcePassages.$inferInsert;
export type WikiConcept = typeof wikiConcepts.$inferSelect;
export type WikiRelationship = typeof wikiRelationships.$inferSelect;
