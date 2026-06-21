import { beforeEach, describe, expect, it } from 'vitest';
import type { IngestionRunRepository } from '../knowledgebase';
import type { ProjectSourceRepository } from '../project-sources';
import { deleteProject, ProjectDeleteBlockedError } from './delete-project.action';
import { loadProjectDetail } from './load-project-detail.action';
import { ProjectForbiddenError } from './project.errors';
import type { AuditLogRepository, ProjectRecord, ProjectRepository } from './project.types';
import { updateProjectDetails } from './update-project-details.action';

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

    expect(project.title).toBe('Updated title');
    expect(project.description).toBe('Updated description');
    expect(project.status).toBe('reviewing');
    expect(state.auditLogs.length).toBe(1);
    expect(state.auditLogs[0]?.action).toBe('project.details.updated');
  });

  it('rejects actors that do not own the project', async () => {
    const existingProject = requireProject(state);

    await expect(
      updateProjectDetails(
        {
          description: 'Updated description',
          projectId: existingProject.id,
          title: 'Updated title',
        },
        createDeps(state),
        { id: 'other-user' }
      )
    ).rejects.toThrow(ProjectForbiddenError);

    expect(requireProject(state).title).toBe('Original title');
    expect(state.auditLogs.length).toBe(0);
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

    expect(project.id).toBe(state.deletedProject?.id);
    expect(state.project).toBe(null);
    expect(state.auditLogs.length).toBe(1);
    expect(state.auditLogs[0]?.action).toBe('project.deleted');
    expect(state.auditLogs[0]?.metadata?.title).toBe('Original title');
  });

  it('blocks delete while project is processing', async () => {
    const existingProject = requireProject(state);
    state.project = {
      ...existingProject,
      status: 'processing',
    };

    await expect(
      deleteProject(
        {
          projectId: existingProject.id,
        },
        createDeps(state),
        actor
      )
    ).rejects.toThrow(ProjectDeleteBlockedError);

    expect(requireProject(state).status).toBe('processing');
    expect(state.deletedProject).toBe(null);
    expect(state.auditLogs.length).toBe(0);
  });

  it('rejects actors that do not own the project', async () => {
    const existingProject = requireProject(state);

    await expect(
      deleteProject(
        {
          projectId: existingProject.id,
        },
        createDeps(state),
        { id: 'other-user' }
      )
    ).rejects.toThrow(ProjectForbiddenError);

    expect(state.deletedProject).toBe(null);
    expect(state.auditLogs.length).toBe(0);
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

    expect(detail.project.ownerId).toBe('owner-1');
    expect(detail.sources.length).toBe(1);
    expect(detail.knowledgebaseGraph.source).toBe('none');
    expect(detail.knowledgebaseGraph.concepts.length).toBe(0);
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
        projectRepository: createProjectRepository(state),
        projectSourceRepository: createProjectSourceRepository({ content: '' }),
      }
    );

    expect(detail.sources.length).toBe(1);
    expect(detail.knowledgebaseGraph.source).toBe('none');
    expect(detail.knowledgebaseGraph.concepts.length).toBe(0);
    expect(detail.knowledgebaseGraph.relationships.length).toBe(0);
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
        projectRepository: createProjectRepository(state),
        projectSourceRepository: createProjectSourceRepository({
          updatedAt: new Date('2026-05-15T00:01:00.000Z'),
        }),
      }
    );

    expect(detail.knowledgebaseGraph.source).toBe('none');
    expect(detail.knowledgebaseGraph.concepts.length).toBe(0);
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

function requireProject(state: TestState): ProjectRecord {
  expect(state.project).toBeTruthy();

  return state.project as ProjectRecord;
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
    async findByIdForOwner() {
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
        status: status,
      };

      return state.project;
    },
  };
}
