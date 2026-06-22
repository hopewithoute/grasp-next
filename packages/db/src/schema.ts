import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
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


export const ingestionRuns = pgTable(
  'ingestion_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourceId: text('source_id'),
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
  projects,
  session,
  user,
  verification,
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
export type NewIngestionRun = typeof ingestionRuns.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
