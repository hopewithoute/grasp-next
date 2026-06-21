import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvidenceKbService } from './evidence-kb-service';

vi.mock('server-only', () => ({}));

const fetchMock = vi.fn();

describe('createEvidenceKbService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
  });

  it('returns null when the Evidence KB base URL is not configured', () => {
    const service = createEvidenceKbService({
      projectRepository: createProjectRepository(),
    });

    expect(service).toBeNull();
  });

  it('maps owner-scoped source ingestion to the Evidence KB contract', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ingestionRunId: 'kb-run-1',
        passageCount: 2,
        sourceId: 'kb-source-1',
        status: 'completed',
        warningCount: 1,
      })
    );

    const service = createEvidenceKbService({
      apiKey: 'secret',
      baseUrl: 'http://evidence-kb.local/',
      projectRepository: createProjectRepository(),
    });

    const result = await service?.ingestSourceForOwner({
      content: '# PostgreSQL',
      ownerId: 'owner-1',
      projectId: 'project-1',
      sourceId: 'source-1',
      sourceTitle: 'Source 1',
      sourceType: 'markdown',
    });

    expect(result).toEqual(expect.objectContaining({ passageCount: 2 }));
    expect(fetchMock).toHaveBeenCalledWith(
      'http://evidence-kb.local/v1/ingest/source',
      expect.objectContaining({
        body: JSON.stringify({
          externalSourceId: 'source-1',
          metadata: { sourceTitle: 'Source 1' },
          projectId: 'project-1',
          sourceType: 'markdown',
          tenantId: 'owner-1',
          text: '# PostgreSQL',
          title: 'Source 1',
        }),
        method: 'POST',
      })
    );
    expect(getFetchHeaders().get('x-api-key')).toBe('secret');
  });

  it('lists sources using project and tenant identifiers', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    const service = createEvidenceKbService({
      baseUrl: 'http://evidence-kb.local',
      projectRepository: createProjectRepository(),
    });

    await service?.listSourcesForOwner({ ownerId: 'owner-1', projectId: 'project-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://evidence-kb.local/v1/projects/project-1/sources?tenantId=owner-1',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('lists and inspects passages after ownership check', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    const service = createEvidenceKbService({
      baseUrl: 'http://evidence-kb.local',
      projectRepository: createProjectRepository(),
    });

    await service?.listPassagesForOwner({
      ownerId: 'owner-1',
      projectId: 'project-1',
      sourceId: 'kb-source-1',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://evidence-kb.local/v1/sources/kb-source-1/passages',
      expect.objectContaining({ method: 'GET' })
    );

    fetchMock.mockResolvedValue(jsonResponse({ id: 'passage-1' }));
    await service?.inspectPassageForOwner({
      ownerId: 'owner-1',
      passageId: 'passage-1',
      projectId: 'project-1',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://evidence-kb.local/v1/passages/passage-1',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('maps retrieve requests with filters', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        contexts: [],
        debug: {},
        query: 'postgres',
        retrievalMode: 'hybrid',
        retrievalRunId: 'ret-1',
      })
    );
    const service = createEvidenceKbService({
      baseUrl: 'http://evidence-kb.local',
      projectRepository: createProjectRepository(),
    });

    await service?.retrieveForOwner({
      filters: { passageStatus: ['certified'], retrievalEnabled: true },
      ownerId: 'owner-1',
      projectId: 'project-1',
      query: 'postgres',
      topK: 5,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://evidence-kb.local/v1/retrieve',
      expect.objectContaining({
        body: JSON.stringify({
          filters: { passageStatus: ['certified'], retrievalEnabled: true },
          mode: 'hybrid',
          projectId: 'project-1',
          query: 'postgres',
          tenantId: 'owner-1',
          topK: 5,
        }),
        method: 'POST',
      })
    );
  });

  it('maps curation actions', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [{ action: {}, ok: true }] }));
    const service = createEvidenceKbService({
      baseUrl: 'http://evidence-kb.local',
      projectRepository: createProjectRepository(),
    });

    await service?.applyCurationForOwner({
      actions: [{ passageId: 'passage-1', type: 'certify_passage' }],
      ownerId: 'owner-1',
      projectId: 'project-1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://evidence-kb.local/v1/curation/apply',
      expect.objectContaining({
        body: JSON.stringify({ actions: [{ passageId: 'passage-1', type: 'certify_passage' }] }),
        method: 'POST',
      })
    );
  });

  it('fails before calling Evidence KB when the project is not owned by the actor', async () => {
    const service = createEvidenceKbService({
      baseUrl: 'http://evidence-kb.local',
      projectRepository: createProjectRepository(null),
    });

    await expect(
      service?.retrieveForOwner({
        ownerId: 'owner-1',
        projectId: 'project-1',
        query: 'postgres',
      })
    ).rejects.toThrow('Unauthorized');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces Evidence KB HTTP errors', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('boom'),
    });
    const service = createEvidenceKbService({
      baseUrl: 'http://evidence-kb.local',
      projectRepository: createProjectRepository(),
    });

    await expect(
      service?.listSourcesForOwner({ ownerId: 'owner-1', projectId: 'project-1' })
    ).rejects.toThrow('Evidence KB request failed: 500 boom');
  });
});

function createProjectRepository(project: { id: string } | null = { id: 'project-1' }) {
  return {
    findByIdForOwner: vi.fn().mockResolvedValue(project),
  } as never;
}

function jsonResponse(body: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

function getFetchHeaders() {
  const [, init] = fetchMock.mock.calls.at(-1) ?? [];
  return init?.headers as Headers;
}
