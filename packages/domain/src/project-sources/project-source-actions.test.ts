import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { AUDIT_ACTION, PROJECT_STATUS, type ProjectSourceType } from '../constants';
import { ProjectForbiddenError } from '../projects/project.errors';
import type {
  AuditLogRepository,
  ProjectRecord,
  ProjectRepository,
  ProjectStatus,
} from '../projects/project.types';
import {
  addProjectSource,
  deleteProjectSource,
  updateProjectSource,
} from './project-source.actions';
import type { ProjectSourceRecord, ProjectSourceRepository } from './project-source.types';

const actor = { id: 'owner-1' };

describe('project source actions', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
  });

  it('adds an owner-scoped markdown source and writes an audit log', async () => {
    const source = await addProjectSource(
      {
        content: '# Photosynthesis\n\nPlants use light.',
        projectId: state.project.id,
        title: 'Textbook excerpt',
        type: 'markdown',
      },
      createDeps(state),
      actor
    );

    assert.equal(source.title, 'Textbook excerpt');
    assert.equal(source.type, 'markdown');
    assert.equal(state.sources.length, 1);
    assert.equal(state.auditLogs[0]?.action, AUDIT_ACTION.PROJECT_SOURCE_CREATED);
    assert.equal(state.auditLogs[0]?.metadata?.sourceId, source.id);
  });

  it('updates an owner-scoped source and writes an audit log', async () => {
    state.sources.push(createSource(state.project.id));

    const source = await updateProjectSource(
      {
        content: 'Updated source body.',
        sourceId: state.sources[0].id,
        title: 'Updated source',
        type: 'text',
      },
      createDeps(state),
      actor
    );

    assert.equal(source.title, 'Updated source');
    assert.equal(source.content, 'Updated source body.');
    assert.equal(state.auditLogs[0]?.action, AUDIT_ACTION.PROJECT_SOURCE_UPDATED);
  });

  it('deletes an owner-scoped source and writes an audit log', async () => {
    state.sources.push(createSource(state.project.id));

    const source = await deleteProjectSource(
      {
        sourceId: state.sources[0].id,
      },
      createDeps(state),
      actor
    );

    assert.equal(source.id, '77777777-7777-4777-8777-777777777777');
    assert.equal(state.sources.length, 0);
    assert.equal(state.auditLogs[0]?.action, AUDIT_ACTION.PROJECT_SOURCE_DELETED);
  });

  it('rejects source writes for non-owners', async () => {
    await assert.rejects(
      addProjectSource(
        {
          content: 'Plants use light.',
          projectId: state.project.id,
          title: 'Textbook excerpt',
          type: 'text',
        },
        createDeps(state),
        { id: 'other-user' }
      ),
      ProjectForbiddenError
    );

    assert.equal(state.sources.length, 0);
    assert.equal(state.auditLogs.length, 0);
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
  project: ProjectRecord;
  sources: ProjectSourceRecord[];
};

function createTestState(): TestState {
  const now = new Date('2026-05-18T00:00:00.000Z');

  return {
    auditLogs: [],
    project: {
      createdAt: now,
      description: null,
      id: '33333333-3333-4333-8333-333333333333',
      ownerId: actor.id,
      status: PROJECT_STATUS.DRAFT,
      title: 'Biology',
      updatedAt: now,
    },
    sources: [],
  };
}

function createSource(projectId: string): ProjectSourceRecord {
  const now = new Date('2026-05-18T00:00:00.000Z');

  return {
    content: 'Plants use light.',
    createdAt: now,
    fileRef: null,
    id: '77777777-7777-4777-8777-777777777777',
    metadata: null,
    projectId,
    title: 'Textbook excerpt',
    type: 'text',
    updatedAt: now,
  };
}

function createDeps(state: TestState) {
  return {
    auditLogRepository: createAuditLogRepository(state),
    projectRepository: createProjectRepository(state),
    projectSourceRepository: createProjectSourceRepository(state),
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

function createProjectSourceRepository(state: TestState): ProjectSourceRepository {
  return {
    async createForProjectOwner(projectId, ownerId, input) {
      if (state.project.id !== projectId || state.project.ownerId !== ownerId) {
        return null;
      }

      const source: ProjectSourceRecord = {
        content: input.content ?? null,
        createdAt: new Date('2026-05-18T00:00:00.000Z'),
        fileRef: input.fileRef ?? null,
        id: '77777777-7777-4777-8777-777777777777',
        metadata: input.metadata ?? null,
        projectId,
        title: input.title,
        type: input.type,
        updatedAt: new Date('2026-05-18T00:00:00.000Z'),
      };

      state.sources.push(source);

      return source;
    },
    async deleteForProjectOwner(sourceId, ownerId) {
      if (state.project.ownerId !== ownerId) {
        return null;
      }

      const source = state.sources.find((item) => item.id === sourceId);

      if (!source) {
        return null;
      }

      state.sources = state.sources.filter((item) => item.id !== sourceId);

      return source;
    },
    async listByProject(projectId) {
      return state.sources.filter((source) => source.projectId === projectId);
    },
    async listByProjectForOwner(projectId, ownerId) {
      if (state.project.id !== projectId || state.project.ownerId !== ownerId) {
        return [];
      }

      return this.listByProject(projectId);
    },
    async updateForProjectOwner(sourceId, ownerId, input) {
      if (state.project.ownerId !== ownerId) {
        return null;
      }

      const source = state.sources.find((item) => item.id === sourceId);

      if (!source) {
        return null;
      }

      source.content = input.content ?? null;
      source.fileRef = input.fileRef ?? null;
      source.metadata = input.metadata ?? null;
      source.title = input.title;
      source.type = input.type as ProjectSourceType;
      source.updatedAt = new Date('2026-05-18T01:00:00.000Z');

      return source;
    },
  };
}
