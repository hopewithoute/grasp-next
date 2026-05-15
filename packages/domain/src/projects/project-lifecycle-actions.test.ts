import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { deleteProject, ProjectDeleteBlockedError } from "./delete-project.action";
import { ProjectForbiddenError } from "./submit-source-material.action";
import { updateProjectDetails } from "./update-project-details.action";
import type {
  AuditLogRepository,
  ProjectRecord,
  ProjectRepository,
  ProjectStatus,
} from "./project.types";

const actor = { id: "owner-1" };

describe("updateProjectDetails", () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
  });

  it("updates owner project metadata without changing status", async () => {
    const existingProject = requireProject(state);
    const project = await updateProjectDetails(
      {
        description: "Updated description",
        projectId: existingProject.id,
        title: "Updated title",
      },
      createDeps(state),
      actor
    );

    assert.equal(project.title, "Updated title");
    assert.equal(project.description, "Updated description");
    assert.equal(project.status, "reviewing");
    assert.equal(state.auditLogs.length, 1);
    assert.equal(state.auditLogs[0]?.action, "project.details.updated");
  });

  it("rejects actors that do not own the project", async () => {
    const existingProject = requireProject(state);

    await assert.rejects(
      updateProjectDetails(
        {
          description: "Updated description",
          projectId: existingProject.id,
          title: "Updated title",
        },
        createDeps(state),
        { id: "other-user" }
      ),
      ProjectForbiddenError
    );

    assert.equal(requireProject(state).title, "Original title");
    assert.equal(state.auditLogs.length, 0);
  });
});

describe("deleteProject", () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
  });

  it("deletes owner project after writing an audit log", async () => {
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
    assert.equal(state.auditLogs[0]?.action, "project.deleted");
    assert.equal(state.auditLogs[0]?.metadata?.title, "Original title");
  });

  it("blocks delete while project is processing", async () => {
    const existingProject = requireProject(state);
    state.project = {
      ...existingProject,
      status: "processing",
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

    assert.equal(requireProject(state).status, "processing");
    assert.equal(state.deletedProject, null);
    assert.equal(state.auditLogs.length, 0);
  });

  it("rejects actors that do not own the project", async () => {
    const existingProject = requireProject(state);

    await assert.rejects(
      deleteProject(
        {
          projectId: existingProject.id,
        },
        createDeps(state),
        { id: "other-user" }
      ),
      ProjectForbiddenError
    );

    assert.equal(state.deletedProject, null);
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
  deletedProject: ProjectRecord | null;
  project: ProjectRecord | null;
};

function createTestState(): TestState {
  const now = new Date("2026-05-15T00:00:00.000Z");

  return {
    auditLogs: [],
    deletedProject: null,
    project: {
      createdAt: now,
      description: "Original description",
      id: "33333333-3333-4333-8333-333333333333",
      ownerId: actor.id,
      sourceMaterial: "Photosynthesis uses light.",
      status: "reviewing",
      title: "Original title",
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

function createProjectRepository(state: TestState): ProjectRepository {
  return {
    async create() {
      throw new Error("Not needed for this test.");
    },
    async deleteForOwner(projectId, ownerId) {
      if (
        !state.project ||
        state.project.id !== projectId ||
        state.project.ownerId !== ownerId
      ) {
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
      if (
        !state.project ||
        state.project.id !== projectId ||
        state.project.ownerId !== ownerId
      ) {
        return null;
      }

      state.project = {
        ...state.project,
        description: input.description ?? null,
        title: input.title,
      };

      return state.project;
    },
    async updateSourceMaterial() {
      throw new Error("Not needed for this test.");
    },
    async updateSourceMaterialForOwner() {
      throw new Error("Not needed for this test.");
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
