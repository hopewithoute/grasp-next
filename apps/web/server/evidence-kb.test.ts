import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvidenceKbService } from './evidence-kb';

vi.mock('server-only', () => ({}));

const fetchMock = vi.fn();

describe('createEvidenceKbService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
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
    const req = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(req.url).toBe('http://evidence-kb.local/v1/ingest/source');
    expect(req.method).toBe('POST');
    expect(await req.json()).toEqual(expect.objectContaining({ externalSourceId: 'source-1' }));
    expect(req.headers.get('x-api-key')).toBe('secret');
  });

  it('lists sources using project and tenant identifiers', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    const service = createEvidenceKbService({
      baseUrl: 'http://evidence-kb.local',
      projectRepository: createProjectRepository(),
    });

    await service?.listSourcesForOwner({ ownerId: 'owner-1', projectId: 'project-1' });

    const req = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(req.url).toContain('sources');
    expect(req.method).toBe('GET');
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
    const req1 = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(req1.url).toContain('kb-source-1/passages');

    fetchMock.mockResolvedValue(jsonResponse({ id: 'passage-1' }));
    await service?.inspectPassageForOwner({
      ownerId: 'owner-1',
      passageId: 'passage-1',
      projectId: 'project-1',
    });
    const req2 = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(req2.url).toContain('passage-1');
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

    const req = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(req.url).toContain('/v1/retrieve');
    expect(req.method).toBe('POST');
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

    const req = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(req.url).toContain('/v1/curation');
  });

  it('maps source deletion', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ deleted: true, ok: true }));
    const service = createEvidenceKbService({
      baseUrl: 'http://evidence-kb.local',
      projectRepository: createProjectRepository(),
    });

    await service?.deleteSourceForOwner({
      ownerId: 'owner-1',
      projectId: 'project-1',
      sourceId: 'source-1',
    });

    const req = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(req.url).toContain('source-1');
    expect(req.method).toBe('DELETE');
  });

  it('maps project deletion', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ deleted: true, ok: true }));
    const service = createEvidenceKbService({
      baseUrl: 'http://evidence-kb.local',
      projectRepository: createProjectRepository(),
    });

    await service?.deleteProjectForOwner({
      ownerId: 'owner-1',
      projectId: 'project-1',
    });

    const req = fetchMock.mock.calls.at(-1)?.[0] as Request;
    expect(req.url).toContain('project-1');
    expect(req.method).toBe('DELETE');
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
    fetchMock.mockResolvedValue(jsonResponse('boom', { ok: false, status: 500 }));

    const service = createEvidenceKbService({
      baseUrl: 'http://evidence-kb.local',
      projectRepository: createProjectRepository(),
    });

    await expect(
      service?.listSourcesForOwner({ ownerId: 'owner-1', projectId: 'project-1' })
    ).rejects.toThrow('"boom"');
  });
});

function createProjectRepository(project: { id: string } | null = { id: 'project-1' }) {
  return {
    findByIdForOwner: vi.fn().mockResolvedValue(project),
  } as never;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonResponse(body: unknown, init: any = { ok: true, status: 200 }) {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok: init.ok,
    status: init.status,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    headers: {
      get: () => 'application/json',
      forEach: () => {},
      entries: () => [['content-type', 'application/json']],
    },
    clone: function () {
      return this;
    },
  };
}
