import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  ARTIFACT_STATUS,
  ARTIFACT_TYPE,
  AUDIT_ACTION,
  CONCEPT_EXTRACTION_WORKFLOW,
  EXTRACTION_MODE,
  PROJECT_STATUS,
} from '../constants';
import type {
  ArtifactRecord,
  ArtifactRepository,
  ArtifactReviewRunRecord,
  ArtifactReviewRunRepository,
  ArtifactVersionRecord,
} from '../artifacts/artifact.types';
import type { ConceptRepository } from '../concepts/concept.types';
import type {
  AuditLogRepository,
  ProjectRecord,
  ProjectRepository,
  ProjectStatus,
} from '../projects/project.types';
import { processConceptExtraction } from './process-concept-extraction.action';
import type { ConceptExtractionWorkflow } from './process-concept-extraction.types';

describe('processConceptExtraction', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
  });

  it('stores a suspended review artifact and moves the project to reviewing after extraction', async () => {
    const result = await processConceptExtraction(
      {
        ownerId: state.project.ownerId,
        projectId: state.project.id,
        sourceMaterial: state.project.sourceMaterial ?? '',
      },
      createDeps(state)
    );

    assert.equal(state.artifact?.status, ARTIFACT_STATUS.GENERATED);
    assert.equal(state.artifact?.type, ARTIFACT_TYPE.CONCEPT_GRAPH);
    assert.equal(state.project.status, PROJECT_STATUS.REVIEWING);
    assert.equal(state.versions.length, 1);
    assert.equal(state.versions[0]?.extractionMode, EXTRACTION_MODE.LLM_JSON);
    assert.equal(state.reviewRuns.length, 1);
    assert.equal(state.reviewRuns[0]?.resumeLabel, CONCEPT_EXTRACTION_WORKFLOW.REVIEW_RESUME_LABEL);
    assert.equal(state.persistedConcepts.length, 1);
    assert.equal(state.persistedConcepts[0]?.confidence, '0.91');
    assert.equal(result.conceptCount, 1);
    assert.equal(result.relationshipCount, 0);
    assert.equal(state.auditLogs.at(-1)?.action, AUDIT_ACTION.PROJECT_CONCEPT_EXTRACTION_COMPLETED);
  });

  it('marks an existing concept graph artifact failed when persistence fails after workflow extraction', async () => {
    state.artifact = createArtifact(state, ARTIFACT_STATUS.GENERATING);
    state.failOnCreateVersion = true;

    await assert.rejects(
      processConceptExtraction(
        {
          ownerId: state.project.ownerId,
          projectId: state.project.id,
          sourceMaterial: state.project.sourceMaterial ?? '',
        },
        createDeps(state)
      ),
      /create version failed/
    );

    assert.equal(state.project.status, PROJECT_STATUS.FAILED);
    assert.equal(state.artifact.status, ARTIFACT_STATUS.FAILED);
    assert.equal(state.reviewRuns.length, 0);
    assert.equal(state.auditLogs.at(-1)?.action, AUDIT_ACTION.PROJECT_CONCEPT_EXTRACTION_FAILED);
    assert.equal(state.auditLogs.at(-1)?.metadata?.reason, 'create version failed');
  });

  it('recovers a failed project and artifact on retry by creating a new generated version', async () => {
    state.project.status = PROJECT_STATUS.FAILED;
    state.artifact = createArtifact(state, ARTIFACT_STATUS.FAILED);

    await processConceptExtraction(
      {
        ownerId: state.project.ownerId,
        projectId: state.project.id,
        revisionFeedback: 'Keep evidence short.',
        sourceMaterial: state.project.sourceMaterial ?? '',
      },
      createDeps(state)
    );

    assert.equal(state.project.status, PROJECT_STATUS.REVIEWING);
    assert.equal(state.artifact.status, ARTIFACT_STATUS.GENERATED);
    assert.equal(state.versions.length, 1);
    assert.equal(state.versions[0]?.revisionFeedback, 'Keep evidence short.');
    assert.equal(state.reviewRuns.length, 1);
    assert.match(state.workflowInputs[0]?.sourceMaterial ?? '', /Revision instructions/);
    assert.equal(state.auditLogs.at(-1)?.action, AUDIT_ACTION.PROJECT_CONCEPT_EXTRACTION_COMPLETED);
  });
});

type TestState = {
  artifact: ArtifactRecord | null;
  auditLogs: Array<{
    action: string;
    actorId?: string;
    entityId: string;
    entityType: string;
    metadata?: Record<string, unknown>;
  }>;
  failOnCreateVersion: boolean;
  persistedConcepts: Array<{
    confidence: string;
    definition: string;
    difficulty: 'advanced' | 'beginner' | 'intermediate';
    name: string;
    sourceEvidence: unknown;
  }>;
  project: ProjectRecord;
  reviewRuns: ArtifactReviewRunRecord[];
  versions: ArtifactVersionRecord[];
  workflowInputs: Array<{ projectId: string; sourceMaterial: string }>;
};

function createTestState(): TestState {
const now = new Date('2026-05-15T00:00:00.000Z');
const ownerId = '55555555-5555-4555-8555-555555555555';

  return {
    artifact: null,
    auditLogs: [],
    failOnCreateVersion: false,
    persistedConcepts: [],
    project: {
      createdAt: now,
      description: null,
      id: '33333333-3333-4333-8333-333333333333',
      ownerId,
      sourceMaterial: 'Markets coordinate supply and demand.',
      status: PROJECT_STATUS.PROCESSING,
      title: 'Economics',
      updatedAt: now,
    },
    reviewRuns: [],
    versions: [],
    workflowInputs: [],
  };
}

function createDeps(state: TestState) {
  return {
    artifactRepository: createArtifactRepository(state),
    artifactReviewRunRepository: createArtifactReviewRunRepository(state),
    auditLogRepository: createAuditLogRepository(state),
    conceptExtractionWorkflow: createConceptExtractionWorkflow(state),
    conceptRepository: createConceptRepository(state),
    projectRepository: createProjectRepository(state),
  };
}

function createArtifact(state: TestState, status: ArtifactRecord['status']): ArtifactRecord {
  const now = new Date('2026-05-15T00:00:00.000Z');

  return {
    createdAt: now,
    currentVersionId: null,
    id: '11111111-1111-4111-8111-111111111111',
    projectId: state.project.id,
    status,
    type: ARTIFACT_TYPE.CONCEPT_GRAPH,
    updatedAt: now,
  };
}

function createArtifactRepository(state: TestState): ArtifactRepository {
  return {
    async create(input) {
      state.artifact = createArtifact(state, input.status);

      return state.artifact;
    },
    async createVersion(input) {
      if (state.failOnCreateVersion) {
        throw new Error('create version failed');
      }

      const version: ArtifactVersionRecord = {
        artifactId: input.artifactId,
        content: input.content,
        createdAt: new Date('2026-05-15T00:00:00.000Z'),
        id: `22222222-2222-4222-8222-${String(state.versions.length + 1).padStart(12, '0')}`,
        extractionMode: input.extractionMode ?? EXTRACTION_MODE.DETERMINISTIC,
        revisionFeedback: input.revisionFeedback ?? null,
        versionNumber: state.versions.length + 1,
      };

      state.versions.push(version);

      if (state.artifact) {
        state.artifact = {
          ...state.artifact,
          currentVersionId: version.id,
        };
      }

      return version;
    },
    async findById(artifactId) {
      return state.artifact?.id === artifactId ? state.artifact : null;
    },
    async findByProjectAndType(projectId, type) {
      return state.artifact?.projectId === projectId && state.artifact.type === type
        ? state.artifact
        : null;
    },
    async findOrCreateForProject(input) {
      if (state.artifact?.projectId === input.projectId && state.artifact.type === input.type) {
        return state.artifact;
      }

      return this.create(input);
    },
    async listVersions(artifactId) {
      return state.versions.filter((version) => version.artifactId === artifactId);
    },
    async updateStatus(artifactId, status) {
      if (!state.artifact || state.artifact.id !== artifactId) {
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
    async createSuspended(input) {
      const reviewRun: ArtifactReviewRunRecord = {
        artifactId: input.artifactId,
        artifactVersionId: input.artifactVersionId,
        createdAt: new Date('2026-05-15T00:00:00.000Z'),
        id: `44444444-4444-4444-8444-${String(state.reviewRuns.length + 1).padStart(12, '0')}`,
        resumeLabel: input.resumeLabel,
        resumeLabels: input.resumeLabels ?? null,
        status: 'suspended',
        suspendedSteps: input.suspendedSteps,
        updatedAt: new Date('2026-05-15T00:00:00.000Z'),
        workflowId: input.workflowId,
        workflowRunId: input.workflowRunId,
      };

      state.reviewRuns.push(reviewRun);

      return reviewRun;
    },
    async findByArtifactVersionId(artifactVersionId) {
      return state.reviewRuns.find((reviewRun) => reviewRun.artifactVersionId === artifactVersionId) ?? null;
    },
    async updateStatus(reviewRunId, status) {
      const reviewRun = state.reviewRuns.find((item) => item.id === reviewRunId);

      if (!reviewRun) {
        return null;
      }

      reviewRun.status = status;

      return reviewRun;
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

function createConceptExtractionWorkflow(state: TestState): ConceptExtractionWorkflow {
  return {
    async runAndSuspend(input) {
      state.workflowInputs.push(input);

      return {
        conceptGraph: {
          concepts: [
            {
              confidence: 0.91,
              definition: 'A place where buyers and sellers coordinate exchange.',
              difficulty: 'beginner',
              name: 'Market',
              sourceEvidence: [{ excerpt: 'Markets coordinate supply and demand.' }],
            },
          ],
          relationships: [],
        },
        extractionMode: EXTRACTION_MODE.LLM_JSON,
        resumeLabels: [CONCEPT_EXTRACTION_WORKFLOW.REVIEW_RESUME_LABEL],
        suspendedSteps: [[CONCEPT_EXTRACTION_WORKFLOW.STEP_ID]],
        workflowRunId: 'workflow-run-1',
      };
    },
  };
}

function createConceptRepository(state: TestState): ConceptRepository {
  return {
    async listByProject() {
      throw new Error('Not needed for this test.');
    },
    async replaceForProject(_projectId, input) {
      state.persistedConcepts = input.concepts;

      return {
        concepts: input.concepts.map((concept, index) => ({
          ...concept,
          createdAt: new Date('2026-05-15T00:00:00.000Z'),
          id: `66666666-6666-4666-8666-${String(index + 1).padStart(12, '0')}`,
          projectId: state.project.id,
          updatedAt: new Date('2026-05-15T00:00:00.000Z'),
        })),
        relationships: [],
      };
    },
  };
}

function createProjectRepository(state: TestState): ProjectRepository {
  return {
    async create() {
      throw new Error('Not needed for this test.');
    },
    async deleteForOwner() {
      throw new Error('Not needed for this test.');
    },
    async findById(projectId) {
      return state.project.id === projectId ? state.project : null;
    },
    async findByIdForOwner(projectId, ownerId) {
      return state.project.id === projectId && state.project.ownerId === ownerId
        ? state.project
        : null;
    },
    async listByOwner(ownerId) {
      return state.project.ownerId === ownerId ? [state.project] : [];
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
      if (state.project.id !== projectId) {
        return null;
      }

      state.project = {
        ...state.project,
        status: status as ProjectStatus,
      };

      return state.project;
    },
  };
}
