import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  approveArtifact,
  ArtifactApprovalForbiddenError,
  ArtifactApprovalInvalidStateError,
} from './approve-artifact.action';
import { requestConceptRevision } from './request-concept-revision.action';
import { updateKnowledgebaseConcept } from './update-knowledgebase-concept.action';
import { updateKnowledgebaseConceptEvidence } from './update-knowledgebase-concept-evidence.action';
import { updateKnowledgebaseRelationship } from './update-knowledgebase-relationship.action';
import { updateKnowledgebaseRelationshipEvidence } from './update-knowledgebase-relationship-evidence.action';
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
import type { KnowledgebaseArtifactContentDto, KnowledgebaseRepository } from '../knowledgebase';

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

describe('updateKnowledgebaseConcept', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
    state.version = {
      ...state.version,
      content: knowledgebaseArtifactContent(),
    };
    state.versions[0] = state.version;
  });

  it('creates a new artifact version with patched concept content and regenerated projection', async () => {
    const artifact = await updateKnowledgebaseConcept(
      {
        artifactId: state.artifact.id,
        conceptId: 'atom',
        definition: 'A corrected definition for atoms.',
        difficulty: 'intermediate',
        name: 'Atomic Structure',
      },
      createDeps(state),
      actor
    );

    assert.equal(artifact.status, 'generated');
    assert.equal(state.versions.length, 2);
    assert.equal(state.artifact.currentVersionId, state.versions[1]?.id);

    const content = state.versions[1]?.content as KnowledgebaseArtifactContentDto;
    assert.equal(content.knowledgebase.concepts[0]?.name, 'Atomic Structure');
    assert.equal(content.knowledgebase.concepts[0]?.definition, 'A corrected definition for atoms.');
    assert.equal(content.knowledgebase.concepts[0]?.difficulty, 'intermediate');
    assert.equal(content.graphProjection.nodes[0]?.conceptId, 'atom');
    assert.equal(content.graphProjection.nodes[0]?.label, 'Atomic Structure');
    assert.deepEqual(state.knowledgebaseWrites[0], {
      projectId: state.artifact.projectId,
    });
    assert.equal(state.auditLogs[0]?.action, 'artifact.knowledgebase_concept.updated');
  });

  it('rejects approved artifacts', async () => {
    state.artifact.status = 'approved';

    await assert.rejects(
      updateKnowledgebaseConcept(
        {
          artifactId: state.artifact.id,
          conceptId: 'atom',
          definition: 'A corrected definition for atoms.',
          difficulty: 'intermediate',
          name: 'Atomic Structure',
        },
        createDeps(state),
        actor
      ),
      ArtifactApprovalInvalidStateError
    );

    assert.equal(state.versions.length, 1);
  });
});

describe('updateKnowledgebaseRelationship', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
    state.version = {
      ...state.version,
      content: knowledgebaseArtifactContent(),
    };
    state.versions[0] = state.version;
  });

  it('creates a new artifact version with patched relationship endpoints and regenerated projection', async () => {
    const artifact = await updateKnowledgebaseRelationship(
      {
        artifactId: state.artifact.id,
        relationshipId: 'rel-atom-molecule',
        relationshipType: 'prerequisite',
        sourceConceptId: 'molecule',
        targetConceptId: 'atom',
      },
      createDeps(state),
      actor
    );

    assert.equal(artifact.status, 'generated');
    assert.equal(state.versions.length, 2);
    assert.equal(state.artifact.currentVersionId, state.versions[1]?.id);

    const content = state.versions[1]?.content as KnowledgebaseArtifactContentDto;
    assert.equal(content.knowledgebase.relationships[0]?.sourceConceptId, 'molecule');
    assert.equal(content.knowledgebase.relationships[0]?.targetConceptId, 'atom');
    assert.equal(content.graphProjection.edges[0]?.sourceNodeId, 'node:molecule');
    assert.equal(content.graphProjection.edges[0]?.targetNodeId, 'node:atom');
    assert.deepEqual(state.knowledgebaseWrites[0], {
      projectId: state.artifact.projectId,
    });
    assert.equal(state.auditLogs[0]?.action, 'artifact.knowledgebase_relationship.updated');
  });

  it('rejects self-referential relationship patches', async () => {
    await assert.rejects(
      updateKnowledgebaseRelationship(
        {
          artifactId: state.artifact.id,
          relationshipId: 'rel-atom-molecule',
          relationshipType: 'prerequisite',
          sourceConceptId: 'atom',
          targetConceptId: 'atom',
        },
        createDeps(state),
        actor
      ),
      ArtifactApprovalInvalidStateError
    );

    assert.equal(state.versions.length, 1);
  });
});

describe('updateKnowledgebaseConceptEvidence', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
    state.version = {
      ...state.version,
      content: knowledgebaseArtifactContent(),
    };
    state.versions[0] = state.version;
  });

  it('creates a new artifact version with patched evidence when quote is grounded in the source block', async () => {
    const artifact = await updateKnowledgebaseConceptEvidence(
      {
        artifactId: state.artifact.id,
        blockId: 'source-1:block-0001',
        conceptId: 'atom',
        locationLabel: 'Chemistry source / Block 1',
        originalBlockId: 'source-1:block-0001',
        originalQuote: 'Atoms are the basic units of matter.',
        originalSourceId: 'source-1',
        quote: 'basic units of matter',
        sourceId: 'source-1',
      },
      createDeps(state),
      actor
    );

    assert.equal(artifact.status, 'generated');
    assert.equal(state.versions.length, 2);

    const content = state.versions[1]?.content as KnowledgebaseArtifactContentDto;
    assert.equal(content.knowledgebase.concepts[0]?.sourceRefs[0]?.quote, 'basic units of matter');
    assert.equal(
      content.knowledgebase.concepts[0]?.sourceRefs[0]?.blockId,
      'source-1:block-0001'
    );
    assert.deepEqual(state.knowledgebaseWrites[0], {
      projectId: state.artifact.projectId,
    });
    assert.equal(state.auditLogs[0]?.action, 'artifact.knowledgebase_evidence.updated');
  });

  it('patches concept evidence by original source ref identity instead of rendered index', async () => {
    const content = knowledgebaseArtifactContent();
    content.normalizedSource.blocks.push({
      id: 'source-1:block-0002',
      kind: 'paragraph' as const,
      location: { label: 'Chemistry source / Block 2' },
      order: 1,
      sourceId: 'source-1',
      text: 'Atoms can join into molecules.',
    });
    content.knowledgebase.concepts[0]!.sourceRefs = [
      {
        blockId: 'source-1:block-0001',
        locationLabel: 'Chemistry source / Block 1',
        quote: 'Atoms are the basic units of matter.',
        sourceId: 'source-1',
      },
      {
        blockId: 'source-1:block-0002',
        locationLabel: 'Chemistry source / Block 2',
        quote: 'Atoms can join into molecules.',
        sourceId: 'source-1',
      },
    ];
    state.version = { ...state.version, content };
    state.versions[0] = state.version;

    await updateKnowledgebaseConceptEvidence(
      {
        artifactId: state.artifact.id,
        blockId: 'source-1:block-0002',
        conceptId: 'atom',
        locationLabel: 'Chemistry source / Block 2',
        originalBlockId: 'source-1:block-0002',
        originalQuote: 'Atoms can join into molecules.',
        originalSourceId: 'source-1',
        quote: 'join into molecules',
        sourceId: 'source-1',
      },
      createDeps(state),
      actor
    );

    const nextContent = state.versions[1]?.content as KnowledgebaseArtifactContentDto;
    assert.equal(
      nextContent.knowledgebase.concepts[0]?.sourceRefs[0]?.quote,
      'Atoms are the basic units of matter.'
    );
    assert.equal(nextContent.knowledgebase.concepts[0]?.sourceRefs[1]?.quote, 'join into molecules');
  });

  it('rejects evidence quotes that are not exact source block substrings', async () => {
    await assert.rejects(
      updateKnowledgebaseConceptEvidence(
        {
          artifactId: state.artifact.id,
          blockId: 'source-1:block-0001',
          conceptId: 'atom',
          locationLabel: 'Chemistry source / Block 1',
          originalBlockId: 'source-1:block-0001',
          originalQuote: 'Atoms are the basic units of matter.',
          originalSourceId: 'source-1',
          quote: 'not actually in the block',
          sourceId: 'source-1',
        },
        createDeps(state),
        actor
      ),
      ArtifactApprovalInvalidStateError
    );

    assert.equal(state.versions.length, 1);
  });
});

describe('updateKnowledgebaseRelationshipEvidence', () => {
  let state: TestState;

  beforeEach(() => {
    state = createTestState();
    state.version = {
      ...state.version,
      content: knowledgebaseArtifactContent(),
    };
    state.versions[0] = state.version;
  });

  it('creates a new artifact version with patched relationship evidence when quote is grounded', async () => {
    const artifact = await updateKnowledgebaseRelationshipEvidence(
      {
        artifactId: state.artifact.id,
        blockId: 'source-1:block-0001',
        locationLabel: 'Chemistry source / Block 1',
        originalBlockId: 'source-1:block-0001',
        originalQuote: 'Atoms are the basic units of matter.',
        originalSourceId: 'source-1',
        quote: 'Atoms are the basic units',
        relationshipId: 'rel-atom-molecule',
        sourceId: 'source-1',
      },
      createDeps(state),
      actor
    );

    assert.equal(artifact.status, 'generated');
    assert.equal(state.versions.length, 2);

    const content = state.versions[1]?.content as KnowledgebaseArtifactContentDto;
    assert.equal(
      content.knowledgebase.relationships[0]?.sourceRefs[0]?.quote,
      'Atoms are the basic units'
    );
    assert.equal(state.auditLogs[0]?.action, 'artifact.knowledgebase_relationship_evidence.updated');
  });

  it('patches relationship evidence by original source ref identity instead of rendered index', async () => {
    const content = knowledgebaseArtifactContent();
    content.normalizedSource.blocks.push({
      id: 'source-1:block-0002',
      kind: 'paragraph' as const,
      location: { label: 'Chemistry source / Block 2' },
      order: 1,
      sourceId: 'source-1',
      text: 'Atoms combine before molecules emerge.',
    });
    content.knowledgebase.relationships[0]!.sourceRefs = [
      {
        blockId: 'source-1:block-0001',
        locationLabel: 'Chemistry source / Block 1',
        quote: 'Atoms are the basic units of matter.',
        sourceId: 'source-1',
      },
      {
        blockId: 'source-1:block-0002',
        locationLabel: 'Chemistry source / Block 2',
        quote: 'Atoms combine before molecules emerge.',
        sourceId: 'source-1',
      },
    ];
    state.version = { ...state.version, content };
    state.versions[0] = state.version;

    await updateKnowledgebaseRelationshipEvidence(
      {
        artifactId: state.artifact.id,
        blockId: 'source-1:block-0002',
        locationLabel: 'Chemistry source / Block 2',
        originalBlockId: 'source-1:block-0002',
        originalQuote: 'Atoms combine before molecules emerge.',
        originalSourceId: 'source-1',
        quote: 'combine before molecules',
        relationshipId: 'rel-atom-molecule',
        sourceId: 'source-1',
      },
      createDeps(state),
      actor
    );

    const nextContent = state.versions[1]?.content as KnowledgebaseArtifactContentDto;
    assert.equal(
      nextContent.knowledgebase.relationships[0]?.sourceRefs[0]?.quote,
      'Atoms are the basic units of matter.'
    );
    assert.equal(
      nextContent.knowledgebase.relationships[0]?.sourceRefs[1]?.quote,
      'combine before molecules'
    );
  });

  it('rejects relationship evidence quotes that are not exact source block substrings', async () => {
    await assert.rejects(
      updateKnowledgebaseRelationshipEvidence(
        {
          artifactId: state.artifact.id,
          blockId: 'source-1:block-0001',
          locationLabel: 'Chemistry source / Block 1',
          originalBlockId: 'source-1:block-0001',
          originalQuote: 'Atoms are the basic units of matter.',
          originalSourceId: 'source-1',
          quote: 'not actually in the block',
          relationshipId: 'rel-atom-molecule',
          sourceId: 'source-1',
        },
        createDeps(state),
        actor
      ),
      ArtifactApprovalInvalidStateError
    );

    assert.equal(state.versions.length, 1);
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
  knowledgebaseWrites: Array<{
    projectId: string;
  }>;
  project: ProjectRecord;
  resumeCalls: Array<{
    resumeLabel: string;
    workflowId: string;
    workflowRunId: string;
  }>;
  reviewRun: ArtifactReviewRunRecord;
  version: ArtifactVersionRecord;
  versions: ArtifactVersionRecord[];
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
    knowledgebaseWrites: [],
    project,
    resumeCalls: [],
    reviewRun,
    version,
    versions: [version],
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
    knowledgebaseRepository: createKnowledgebaseRepository(state),
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

function createKnowledgebaseRepository(state: TestState): KnowledgebaseRepository {
  return {
    async addConceptEvidence() {},
    async updateConceptEvidence() {},
    async deleteConceptEvidence() {},
    async createSnapshot() { return null; },
    async addConcept() {},
    async updateConcept() {},
    async deleteConcept() {},
    async addRelationship() {},
    async deleteRelationship() {},
    async findCurrentGraphByProject() {
      return null;
    },
    async findConceptEvidence() {
      return [];
    },
    async findRelationshipEvidence() {
      return [];
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
    async replaceVersionFromContent(input) {
      state.knowledgebaseWrites.push({
        projectId: input.projectId,
      });

      return {
        createdAt: new Date('2026-05-15T00:00:00.000Z'),
        id: `55555555-5555-4555-8555-${String(state.knowledgebaseWrites.length).padStart(12, '0')}`,
        knowledgebaseId: '66666666-6666-4666-8666-666666666666',
        versionNumber: state.knowledgebaseWrites.length,
      };
    },
  };
}

function createArtifactRepository(state: TestState): ArtifactRepository {
  return {
    async create() {
      throw new Error('Not needed for this test.');
    },
    async createVersion(input) {
      const version: ArtifactVersionRecord = {
        artifactId: input.artifactId,
        content: input.content,
        createdAt: new Date('2026-05-15T00:00:00.000Z'),
        extractionMode: input.extractionMode ?? 'llm_json',
        id: `22222222-2222-4222-8222-${String(state.versions.length + 1).padStart(12, '0')}`,
        revisionFeedback: input.revisionFeedback ?? null,
        versionNumber: state.versions.length + 1,
      };

      state.versions.push(version);
      state.version = version;
      state.artifact = {
        ...state.artifact,
        currentVersionId: version.id,
      };

      return version;
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
      return artifactId === state.artifact.id ? state.versions : [];
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

function knowledgebaseArtifactContent() {
  const sourceRef = {
    blockId: 'source-1:block-0001',
    locationLabel: 'Chemistry source / Block 1',
    quote: 'Atoms are the basic units of matter.',
    sourceId: 'source-1',
  };

  return {
    graphProjection: {
      edges: [],
      nodes: [
        {
          conceptId: 'atom',
          id: 'node:atom',
          label: 'Atom',
        },
      ],
    },
    knowledgebase: {
      concepts: [
        {
          confidence: 0.91,
          definition: 'The basic unit of matter.',
          difficulty: 'beginner' as const,
          id: 'atom',
          name: 'Atom',
          sourceRefs: [sourceRef],
        },
        {
          confidence: 0.86,
          definition: 'A group of atoms bonded together.',
          difficulty: 'beginner' as const,
          id: 'molecule',
          name: 'Molecule',
          sourceRefs: [sourceRef],
        },
      ],
      overview: 'Atoms are the basic units of matter.',
      relationships: [
        {
          id: 'rel-atom-molecule',
          relationshipType: 'prerequisite' as const,
          sourceConceptId: 'atom',
          sourceRefs: [sourceRef],
          targetConceptId: 'molecule',
        },
      ],
    },
    normalizedSource: {
      blocks: [
        {
          id: 'source-1:block-0001',
          kind: 'paragraph' as const,
          location: { label: 'Chemistry source / Block 1' },
          order: 0,
          sourceId: 'source-1',
          text: 'Atoms are the basic units of matter.',
        },
      ],
      id: 'project-1:source-set:current',
      sourceType: 'text' as const,
      title: 'Project sources',
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
