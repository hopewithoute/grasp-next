import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLgsService } from './lgs-service';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  deleteCollection: vi.fn(),
  deleteSource: vi.fn(),
  getLocalGraph: vi.fn(),
  indexSource: vi.fn(),
}));

vi.mock('@grasp/lazy-graph-rag-client', () => ({
  LazyGraphRagClient: vi.fn().mockImplementation(() => mocks),
}));

describe('createLgsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the LGS base URL is not configured', () => {
    const service = createLgsService({
      projectRepository: createProjectRepository(),
    });

    expect(service).toBeNull();
  });

  it('maps owner-scoped source indexing to the LGS collection contract', async () => {
    mocks.indexSource.mockResolvedValue({
      chunkCount: 1,
      chunkTermCount: 2,
      contentHash: 'hash-1',
      documentId: 'doc-1',
      status: 'indexed',
      termCount: 2,
    });

    const service = createLgsService({
      apiKey: 'secret',
      baseUrl: 'http://lgs.local',
      projectRepository: createProjectRepository(),
    });

    await service?.indexSourceForOwner({
      content: '# PostgreSQL',
      ownerId: 'owner-1',
      projectId: 'project-1',
      sourceId: 'source-1',
      sourceTitle: 'Source 1',
      sourceType: 'markdown',
    });

    expect(mocks.indexSource).toHaveBeenCalledWith({
      collectionId: 'project-1',
      content: '# PostgreSQL',
      documentName: 'Source 1',
      sourceId: 'source-1',
      sourceType: 'markdown',
      tenantId: 'owner-1',
    });
  });

  it('maps non-markdown source types to text for the LGS index endpoint', async () => {
    mocks.indexSource.mockResolvedValue({
      chunkCount: 1,
      chunkTermCount: 1,
      contentHash: 'hash-1',
      documentId: 'doc-1',
      status: 'indexed',
      termCount: 1,
    });

    const service = createLgsService({
      baseUrl: 'http://lgs.local',
      projectRepository: createProjectRepository(),
    });

    await service?.indexSourceForOwner({
      content: 'Fetched web text',
      ownerId: 'owner-1',
      projectId: 'project-1',
      sourceId: 'source-web',
      sourceTitle: 'Web Source',
      sourceType: 'web',
    });

    expect(mocks.indexSource).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'text',
      })
    );
  });

  it('maps source and collection deletion to LGS IDs', async () => {
    mocks.deleteSource.mockResolvedValue({ deletedDocumentCount: 1, status: 'deleted' });
    mocks.deleteCollection.mockResolvedValue({ deletedDocumentCount: 3, status: 'deleted' });

    const service = createLgsService({
      baseUrl: 'http://lgs.local',
      projectRepository: createProjectRepository(),
    });

    await service?.deleteSourceForOwner({
      ownerId: 'owner-1',
      projectId: 'project-1',
      sourceId: 'source-1',
    });
    await service?.deleteCollectionForOwner({
      ownerId: 'owner-1',
      projectId: 'project-1',
    });

    expect(mocks.deleteSource).toHaveBeenCalledWith({
      collectionId: 'project-1',
      sourceId: 'source-1',
      tenantId: 'owner-1',
    });
    expect(mocks.deleteCollection).toHaveBeenCalledWith({
      collectionId: 'project-1',
      tenantId: 'owner-1',
    });
  });

  it('maps LGS local graph nodes and edges to the legacy UI read model', async () => {
    mocks.getLocalGraph.mockResolvedValue({
      edges: [
        {
          data: { weight: 4 },
          id: 'term-1_term-2',
          source: 'term-1',
          target: 'term-2',
        },
      ],
      nodes: [
        {
          data: {
            frequency: 3,
            label: 'PostgreSQL',
            type: 'technology',
          },
          id: 'term-1',
          position: { x: 0, y: 0 },
        },
        {
          data: {
            frequency: 2,
            label: 'pgvector',
            type: 'tool',
          },
          id: 'term-2',
          position: { x: 100, y: 0 },
        },
      ],
    });

    const service = createLgsService({
      baseUrl: 'http://lgs.local',
      projectRepository: createProjectRepository(),
    });

    const graph = await service?.getLocalGraphForOwner({
      limit: 100,
      ownerId: 'owner-1',
      projectId: 'project-1',
    });

    expect(mocks.getLocalGraph).toHaveBeenCalledWith({
      collectionId: 'project-1',
      limit: 100,
      tenantId: 'owner-1',
    });
    expect(graph).toEqual({
      concepts: [
        expect.objectContaining({
          confidence: '1',
          difficulty: 'beginner',
          evidenceCount: 3,
          id: 'term-1',
          name: 'PostgreSQL',
          sourceEvidence: [],
        }),
        expect.objectContaining({
          evidenceCount: 2,
          id: 'term-2',
          name: 'pgvector',
        }),
      ],
      relationships: [
        {
          evidenceCount: 4,
          id: 'term-1_term-2',
          metadata: { weight: 4 },
          relationshipType: 'co_occurs',
          sourceConceptId: 'term-1',
          sourceEvidence: [],
          targetConceptId: 'term-2',
        },
      ],
      source: 'lgs',
    });
  });

  it('fails before calling LGS when the project is not owned by the actor', async () => {
    const service = createLgsService({
      baseUrl: 'http://lgs.local',
      projectRepository: createProjectRepository(null),
    });

    await expect(
      service?.indexSourceForOwner({
        content: 'Source',
        ownerId: 'owner-1',
        projectId: 'project-1',
        sourceId: 'source-1',
        sourceTitle: 'Source',
        sourceType: 'text',
      })
    ).rejects.toThrow('Unauthorized');

    expect(mocks.indexSource).not.toHaveBeenCalled();
  });
});

function createProjectRepository(project: { id: string } | null = { id: 'project-1' }) {
  return {
    findByIdForOwner: vi.fn().mockResolvedValue(project),
  } as never;
}
