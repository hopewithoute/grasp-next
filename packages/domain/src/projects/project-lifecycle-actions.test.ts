import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import type { IngestionRunRepository, KnowledgebaseRepository } from '../knowledgebase';
import type { ProjectSourceRepository } from '../project-sources';
import { deleteProject, ProjectDeleteBlockedError } from './delete-project.action';
import { loadProjectDetail } from './load-project-detail.action';
import { ProjectForbiddenError } from './project.errors';
import { updateProjectDetails } from './update-project-details.action';
import type {
  AuditLogRepository,
  ProjectRecord,
  ProjectRepository,
  ProjectStatus,
} from './project.types';

const actor = { id: 'owner-1' };

describe('updateProjectDetails', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
  });

  it('updates owner project metadata without changing status', async () => {
    const existingProject = requireProject(state);
    const project = await updateProjectDetails(
      {
        description: 'Updated description',
        projectId: existingProject.id,
        title: 'Updated title',
      },
      createDeps(state),
      actor
    );

    assert.equal(project.title, 'Updated title');
    assert.equal(project.description, 'Updated description');
    assert.equal(project.status, 'reviewing');
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0]?.action, 'project.details.updated');
  });

  it('rejects actors that do not own the project', async () => {
    const existingProject = requireProject(state);

    await assert.rejects(
      updateProjectDetails(
        {
          description: 'Updated description',
          projectId: existingProject.id,
          title: 'Updated title',
        },
        createDeps(state),
        { id: 'other-user' }
      ),
      ProjectForbiddenError
    );

    assert.equal(requireProject(state).title, 'Original title');
    assert.equal(state.auditLogs.length, 0);
  });
});

describe('deleteProject', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
  });

  it('deletes owner project after writing an audit log', async () => {
    const existingProject = requireProject(state);
    const project = await deleteProject(
      {
        projectId: existingProject.id,
      },
      createDeps(state),
      actor
    );

    assert.equal(project.id, state.deletedProject?.id);
    assert.equal(state.project, null);
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0]?.action, 'project.deleted');
    assert.equal(state.auditLogs[0]?.metadata?.title, 'Original title');
  });

  it('blocks delete while project is processing', async () => {
    const existingProject = requireProject(state);
    state.project = {
      ...existingProject,
      status: 'processing',
    };

    await assert.rejects(
      deleteProject(
        {
          projectId: existingProject.id,
        },
        createDeps(state),
        actor
      ),
      ProjectDeleteBlockedError
    );

    assert.equal(requireProject(state).status, 'processing');
    assert.equal(state.deletedProject, null);
    assert.equal(state.auditLogs.length, 0);
  });

  it('rejects actors that do not own the project', async () => {
    const existingProject = requireProject(state);

    await assert.rejects(
      deleteProject(
        {
          projectId: existingProject.id,
        },
        createDeps(state),
        { id: 'other-user' }
      ),
      ProjectForbiddenError
    );

    assert.equal(state.deletedProject, null);
    assert.equal(state.auditLogs.length, 0);
  });
});

describe('loadProjectDetail', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
  });

  it('accepts opaque auth user ids instead of requiring UUID owner ids', async () => {
    const existingProject = requireProject(state);
    const detail = await loadProjectDetail(
      {
        ownerId: actor.id,
        projectId: existingProject.id,
      },
      {
        projectRepository: createProjectRepository(state),
        projectSourceRepository: createProjectSourceRepository(),
      }
    );

    assert.equal(detail.project.ownerId, 'owner-1');
    assert.equal(detail.sources.length, 1);
    assert.equal(detail.knowledgebaseGraph.source, 'none');
    assert.equal(detail.knowledgebaseGraph.concepts.length, 0);
  });

  it('derives graph read data from the current knowledgebase artifact version', async () => {
    const existingProject = requireProject(state);
    const detail = await loadProjectDetail(
      {
        ownerId: actor.id,
        projectId: existingProject.id,
      },
      {
        ingestionRunRepository: createIngestionRunRepository(),
        knowledgebaseRepository: createKnowledgebaseRepository(),
        projectRepository: createProjectRepository(state),
        projectSourceRepository: createProjectSourceRepository(),
      }
    );

    assert.equal(detail.knowledgebaseGraph.source, 'relational_projection');
    assert.equal(detail.knowledgebaseGraph.concepts.length, 1);
    assert.equal(detail.knowledgebaseGraph.concepts[0]?.id, 'relational-market');
    assert.equal(detail.knowledgebaseGraph.relationships.length, 0);
  });

  it('prefers the current relational knowledgebase projection over artifact JSONB', async () => {
    const existingProject = requireProject(state);
    const detail = await loadProjectDetail(
      {
        ownerId: actor.id,
        projectId: existingProject.id,
      },
      {
        ingestionRunRepository: createIngestionRunRepository(),
        knowledgebaseRepository: createKnowledgebaseRepository(),
        projectRepository: createProjectRepository(state),
        projectSourceRepository: createProjectSourceRepository(),
      }
    );

    assert.equal(detail.knowledgebaseGraph.source, 'relational_projection');
    assert.equal(detail.knowledgebaseGraph.concepts.length, 1);
    assert.equal(detail.knowledgebaseGraph.concepts[0]?.id, 'relational-market');
    assert.equal(detail.knowledgebaseGraph.relationships.length, 0);
  });

  it('does not expose stale graph data when the project has no usable source', async () => {
    const existingProject = requireProject(state);
    const detail = await loadProjectDetail(
      {
        ownerId: actor.id,
        projectId: existingProject.id,
      },
      {
        ingestionRunRepository: createIngestionRunRepository(),
        knowledgebaseRepository: createKnowledgebaseRepository(),
        projectRepository: createProjectRepository(state),
        projectSourceRepository: createProjectSourceRepository({ content: '' }),
      }
    );

    assert.equal(detail.sources.length, 1);
    assert.equal(detail.knowledgebaseGraph.source, 'none');
    assert.equal(detail.knowledgebaseGraph.concepts.length, 0);
    assert.equal(detail.knowledgebaseGraph.relationships.length, 0);
  });

  it('does not expose stale graph data when source changed after latest ingestion', async () => {
    const existingProject = requireProject(state);
    const detail = await loadProjectDetail(
      {
        ownerId: actor.id,
        projectId: existingProject.id,
      },
      {
        ingestionRunRepository: createIngestionRunRepository({
          completedAt: new Date('2026-05-15T00:00:00.000Z'),
        }),
        knowledgebaseRepository: createKnowledgebaseRepository(),
        projectRepository: createProjectRepository(state),
        projectSourceRepository: createProjectSourceRepository({
          updatedAt: new Date('2026-05-15T00:01:00.000Z'),
        }),
      }
    );

    assert.equal(detail.knowledgebaseGraph.source, 'none');
    assert.equal(detail.knowledgebaseGraph.concepts.length, 0);
  });
});

type TestState = {
  auditLogs: Array<{
    action: string;
    actorId?: string;
    entityId: string;
    entityType: string;
    metadata?: Record<string, unknown>;
  }>;
  deletedProject: ProjectRecord | null;
  project: ProjectRecord | null;
};

function createTestState(): TestState {
  const now = new Date('2026-05-15T00:00:00.000Z');

  return {
    auditLogs: [],
    deletedProject: null,
    project: {
      createdAt: now,
      description: 'Original description',
      id: '33333333-3333-4333-8333-333333333333',
      ownerId: actor.id,
      status: 'reviewing',
      title: 'Original title',
      updatedAt: now,
    },
  };
}

function requireProject(state: TestState) {
  assert.ok(state.project);

  return state.project;
}

function createDeps(state: TestState) {
  return {
    auditLogRepository: createAuditLogRepository(state),
    projectRepository: createProjectRepository(state),
  };
}

function createAuditLogRepository(state: TestState): AuditLogRepository {
  return {
    async write(input) {
      state.auditLogs.push(input);
    },
  };
}

function createProjectSourceRepository(
  options: {
    content?: string | null;
    updatedAt?: Date;
  } = {}
): ProjectSourceRepository {
  return {
    async createForProjectOwner() {
      throw new Error('Not needed for this test.');
    },
    async deleteForProjectOwner() {
      throw new Error('Not needed for this test.');
    },
    async listByProject(projectId) {
      return [
        {
          content: options.content ?? 'Photosynthesis uses light.',
          createdAt: new Date('2026-05-15T00:00:00.000Z'),
          fileRef: null,
          id: '77777777-7777-4777-8777-777777777777',
          metadata: null,
          projectId,
          title: 'Photosynthesis source',
          type: 'text',
          updatedAt: options.updatedAt ?? new Date('2026-05-15T00:00:00.000Z'),
        },
      ];
    },
    async listByProjectForOwner() {
      throw new Error('Not needed for this test.');
    },
    async updateForProjectOwner() {
      throw new Error('Not needed for this test.');
    },
  };
}

function createIngestionRunRepository(
  options: {
    completedAt?: Date | null;
    status?: 'completed' | 'failed' | 'ingesting';
  } = {}
): IngestionRunRepository {
  const completedAt = options.completedAt ?? new Date('2026-05-15T00:00:00.000Z');
  const status = options.status ?? 'completed';

  return {
    async create() {
      throw new Error('Not needed for this test.');
    },
    async findLatestByProject(projectId) {
      return {
        completedAt: status === 'completed' ? completedAt : null,
        createdAt: new Date('2026-05-15T00:00:00.000Z'),
        failureReason: status === 'failed' ? 'failed' : null,
        id: '88888888-8888-4888-8888-888888888888',
        metadata: null,
        projectId,
        sourceId: null,
        startedAt: new Date('2026-05-15T00:00:00.000Z'),
        status,
        updatedAt: completedAt ?? new Date('2026-05-15T00:00:00.000Z'),
      };
    },
    async markCompleted() {
      throw new Error('Not needed for this test.');
    },
    async markFailed() {
      throw new Error('Not needed for this test.');
    },
  };
}

function createKnowledgebaseRepository(): KnowledgebaseRepository {
  return {
    async addConceptEvidence() {},
    async createSnapshot() { return null; },
    async addConcept() {},
    async updateConcept() {},
    async deleteConcept() {},
    async addRelationship() {},
    async deleteRelationship() {},
    async findCurrentGraphByProject() {
      return {
        concepts: [
          {
            confidence: '0.99',
            definition: 'A relationally loaded market concept.',
            difficulty: 'beginner',
            id: 'relational-market',
            name: 'Relational Market',
            sourceEvidence: [
              {
                blockId: 'source-1:block-0001',
                excerpt: 'Markets coordinate supply and demand.',
                location: 'Market source / Block 1',
                sourceId: 'source-1',
              },
            ],
          },
        ],
        relationships: [],
      };
    },
    async replaceVersionFromContent() {
      throw new Error('Not needed for this test.');
    },
    async searchConceptsForIngestion() {
      return [];
    },
    async searchConceptsWithPagination() {
      return { concepts: [], totalCount: 0 };
    },
    async getConceptContext() {
      return null;
    },
    async mergeIngestionOutput() {
      throw new Error('Not needed for this test.');
    },
    async upsertSourcePassages() {},
    async cleanupDeletedSource() {},
  };
}

function createProjectRepository(state: TestState): ProjectRepository {
  return {
    async create() {
      throw new Error('Not needed for this test.');
    },
    async deleteForOwner(projectId, ownerId) {
      if (!state.project || state.project.id !== projectId || state.project.ownerId !== ownerId) {
        return null;
      }

      state.deletedProject = state.project;
      state.project = null;

      return state.deletedProject;
    },
    async findById(projectId) {
      return state.project?.id === projectId ? state.project : null;
    },
    async findByIdForOwner(projectId, ownerId) {
      return state.project?.id === projectId && state.project.ownerId === ownerId
        ? state.project
        : null;
    },
    async listByOwner(ownerId) {
      return state.project?.ownerId === ownerId ? [state.project] : [];
    },
    async updateDetailsForOwner(projectId, ownerId, input) {
      if (!state.project || state.project.id !== projectId || state.project.ownerId !== ownerId) {
        return null;
      }

      state.project = {
        ...state.project,
        description: input.description ?? null,
        title: input.title,
      };

      return state.project;
    },
    async updateStatus(projectId, status) {
      if (!state.project || state.project.id !== projectId) {
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
