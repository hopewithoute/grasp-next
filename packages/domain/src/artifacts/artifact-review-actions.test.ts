import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  approveArtifact,
  ArtifactApprovalForbiddenError,
  ArtifactApprovalInvalidStateError,
} from './approve-artifact.action';
import { requestConceptRevision } from './request-concept-revision.action';
import type {
  ArtifactRecord,
  ArtifactRepository,
  ArtifactReviewRunRecord,
  ArtifactReviewRunRepository,
  ArtifactVersionRecord,
} from './artifact.types';
import type {
  AuditLogRepository,
  ProjectRecord,
  ProjectRepository,
  ProjectStatus,
} from '../projects/project.types';

const actor = { id: 'owner-1' };

describe('approveArtifact', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
  });

  it('resumes the stored review run, completes it, approves the artifact, and writes an audit log', async () => {
    const artifact = await approveArtifact(
      { artifactId: state.artifact.id },
      createDeps(state, {
        reviewStatus: 'success',
      }),
      actor
    );

    assert.equal(artifact.status, 'approved');
    assert.equal(state.reviewRun.status, 'completed');
    assert.deepEqual(state.resumeCalls, [
      {
        resumeLabel: 'review_concepts',
        workflowId: 'extract-concepts',
        workflowRunId: 'workflow-run-1',
      },
    ]);
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0]?.action, 'artifact.approved');
  });

  it('rejects actors that do not own the artifact project', async () => {
    await assert.rejects(
      approveArtifact({ artifactId: state.artifact.id }, createDeps(state), { id: 'other-user' }),
      ArtifactApprovalForbiddenError
    );

    assert.equal(state.resumeCalls.length, 0);
    assert.equal(state.artifact.status, 'generated');
  });

  it('marks the review run failed when workflow resume does not complete', async () => {
    await assert.rejects(
      approveArtifact(
        { artifactId: state.artifact.id },
        createDeps(state, {
          reviewStatus: 'failed',
        }),
        actor
      ),
      ArtifactApprovalInvalidStateError
    );

    assert.equal(state.reviewRun.status, 'failed');
    assert.equal(state.artifact.status, 'generated');
  });
});

describe('requestConceptRevision', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
  });

  it('marks the current review run resumed, sets revision state, and logs feedback', async () => {
    const artifact = await requestConceptRevision(
      {
        artifactId: state.artifact.id,
        revisionFeedback: 'Split atom and molecule concepts more clearly.',
      },
      createDeps(state),
      actor
    );

    assert.equal(artifact.status, 'needs_revision');
    assert.equal(state.reviewRun.status, 'resumed');
    assert.equal(state.project.status, 'reviewing');
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0]?.action, 'artifact.revision_requested');
    assert.equal(
      state.auditLogs[0]?.metadata?.revisionFeedback,
      'Split atom and molecule concepts more clearly.'
    );
  });

  it('rejects approval-state artifacts that cannot be revised', async () => {
    state.artifact.status = 'approved';

    await assert.rejects(
      requestConceptRevision(
        {
          artifactId: state.artifact.id,
          revisionFeedback: 'Try again.',
        },
        createDeps(state),
        actor
      ),
      ArtifactApprovalInvalidStateError
    );

    assert.equal(state.reviewRun.status, 'suspended');
  });

  it('requires a suspended review run before requesting re-extraction', async () => {
    state.reviewRun.status = 'completed';

    await assert.rejects(
      requestConceptRevision(
        {
          artifactId: state.artifact.id,
          revisionFeedback: 'Try again.',
        },
        createDeps(state),
        actor
      ),
      ArtifactApprovalInvalidStateError
    );

    assert.equal(state.artifact.status, 'generated');
  });
});

type TestState = {
  artifact: ArtifactRecord;
  auditLogs: Array<{
    action: string;
    actorId?: string;
    entityId: string;
    entityType: string;
    metadata?: Record<string, unknown>;
  }>;
  project: ProjectRecord;
  resumeCalls: Array<{
    resumeLabel: string;
    workflowId: string;
    workflowRunId: string;
  }>;
  reviewRun: ArtifactReviewRunRecord;
  version: ArtifactVersionRecord;
};

function createTestState(): TestState {
  const now = new Date('2026-05-15T00:00:00.000Z');
  const version: ArtifactVersionRecord = {
    artifactId: '11111111-1111-4111-8111-111111111111',
    content: { concepts: [] },
    createdAt: now,
    id: '22222222-2222-4222-8222-222222222222',
    extractionMode: 'llm_strict',
    revisionFeedback: null,
    versionNumber: 1,
  };
  const artifact: ArtifactRecord = {
    createdAt: now,
    currentVersionId: version.id,
    id: version.artifactId,
    projectId: '33333333-3333-4333-8333-333333333333',
    status: 'generated',
    type: 'concept_graph',
    updatedAt: now,
  };
  const project: ProjectRecord = {
    createdAt: now,
    description: null,
    id: artifact.projectId,
    ownerId: actor.id,
    sourceMaterial: 'Atoms form molecules.',
    status: 'reviewing',
    title: 'Chemistry',
    updatedAt: now,
  };
  const reviewRun: ArtifactReviewRunRecord = {
    artifactId: artifact.id,
    artifactVersionId: version.id,
    createdAt: now,
    id: '44444444-4444-4444-8444-444444444444',
    resumeLabel: 'review_concepts',
    resumeLabels: ['review_concepts'],
    status: 'suspended',
    suspendedSteps: [['extract-concepts']],
    updatedAt: now,
    workflowId: 'extract-concepts',
    workflowRunId: 'workflow-run-1',
  };

  return {
    artifact,
    auditLogs: [],
    project,
    resumeCalls: [],
    reviewRun,
    version,
  };
}

function createDeps(
  state: TestState,
  options: {
    reviewStatus?: 'success' | 'suspended' | 'failed' | 'unknown';
  } = {}
) {
  return {
    artifactRepository: createArtifactRepository(state),
    artifactReviewRunRepository: createArtifactReviewRunRepository(state),
    auditLogRepository: createAuditLogRepository(state),
    projectRepository: createProjectRepository(state),
    reviewWorkflow: {
      async resumeReview(input: {
        resumeLabel: string;
        workflowId: string;
        workflowRunId: string;
      }) {
        state.resumeCalls.push(input);

        return {
          status: options.reviewStatus ?? 'success',
        };
      },
    },
  };
}

function createArtifactRepository(state: TestState): ArtifactRepository {
  return {
    async create() {
      throw new Error('Not needed for this test.');
    },
    async createVersion() {
      throw new Error('Not needed for this test.');
    },
    async findById(artifactId) {
      return artifactId === state.artifact.id ? state.artifact : null;
    },
    async findByProjectAndType(projectId, type) {
      return projectId === state.artifact.projectId && type === state.artifact.type
        ? state.artifact
        : null;
    },
    async findOrCreateForProject() {
      throw new Error('Not needed for this test.');
    },
    async listVersions(artifactId) {
      return artifactId === state.artifact.id ? [state.version] : [];
    },
    async updateStatus(artifactId, status) {
      if (artifactId !== state.artifact.id) {
        return null;
      }

      state.artifact = {
        ...state.artifact,
        status,
      };

      return state.artifact;
    },
  };
}

function createArtifactReviewRunRepository(state: TestState): ArtifactReviewRunRepository {
  return {
    async createSuspended() {
      throw new Error('Not needed for this test.');
    },
    async findByArtifactVersionId(artifactVersionId) {
      return artifactVersionId === state.reviewRun.artifactVersionId ? state.reviewRun : null;
    },
    async updateStatus(_reviewRunId, status) {
      state.reviewRun = {
        ...state.reviewRun,
        status,
      };

      return state.reviewRun;
    },
  };
}

function createAuditLogRepository(state: TestState): AuditLogRepository {
  return {
    async write(input) {
      state.auditLogs.push(input);
    },
  };
}

function createProjectRepository(state: TestState): ProjectRepository {
  return {
    async create() {
      throw new Error('Not needed for this test.');
    },
    async findById(projectId) {
      return projectId === state.project.id ? state.project : null;
    },
    async findByIdForOwner(projectId, ownerId) {
      return projectId === state.project.id && ownerId === state.project.ownerId
        ? state.project
        : null;
    },
    async listByOwner(ownerId) {
      return ownerId === state.project.ownerId ? [state.project] : [];
    },
    async updateDetailsForOwner() {
      throw new Error('Not needed for this test.');
    },
    async updateSourceMaterial() {
      throw new Error('Not needed for this test.');
    },
    async updateSourceMaterialForOwner() {
      throw new Error('Not needed for this test.');
    },
    async updateStatus(projectId, status) {
      if (projectId !== state.project.id) {
        return null;
      }

      state.project = {
        ...state.project,
        status: status as ProjectStatus,
      };

      return state.project;
    },
    async deleteForOwner() {
      throw new Error('Not needed for this test.');
    },
  };
}
