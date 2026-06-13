import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serverEnv } from './env';
import { runSourceIngestion } from './source-ingestion-runner';

vi.mock('server-only', () => ({}));

vi.mock('./env', () => ({
  serverEnv: {
    LGS_ENABLED: 'true',
  },
}));

describe('runSourceIngestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverEnv.LGS_ENABLED = 'true';
  });

  it('routes ingestion through LGS', async () => {
    const deps = createDeps();
    const lgsService = {
      indexSourceForOwner: vi.fn().mockResolvedValue({
        chunkCount: 2,
        chunkTermCount: 4,
        contentHash: 'hash',
        documentId: 'doc-1',
        status: 'indexed',
        termCount: 3,
      }),
    };
    deps.lgsService = lgsService as never;

    await runSourceIngestion(
      {
        content: 'Source text',
        ownerId: 'owner-1',
        projectId: 'project-1',
        sourceId: 'source-1',
        sourceTitle: 'Source',
        sourceType: 'markdown',
      },
      deps
    );

    expect(deps.ingestionRunRepository.create).toHaveBeenCalledWith({
      projectId: 'project-1',
      sourceId: 'source-1',
    });
    expect(lgsService.indexSourceForOwner).toHaveBeenCalledWith({
      content: 'Source text',
      ownerId: 'owner-1',
      projectId: 'project-1',
      sourceId: 'source-1',
      sourceTitle: 'Source',
      sourceType: 'markdown',
    });
    expect(deps.ingestionRunRepository.markCompleted).toHaveBeenCalledWith('run-1', {
      lgs: expect.objectContaining({ documentId: 'doc-1' }),
    });
  });

  it('emits the LGS completion event', async () => {
    const deps = createDeps();
    deps.lgsService = {
      indexSourceForOwner: vi.fn().mockResolvedValue({
        chunkCount: 2,
        chunkTermCount: 4,
        contentHash: 'hash',
        documentId: 'doc-1',
        status: 'indexed',
        termCount: 3,
      }),
    } as never;
    const onEvent = vi.fn();

    await runSourceIngestion(
      {
        content: 'Source text',
        onEvent,
        ownerId: 'owner-1',
        projectId: 'project-1',
        sourceId: 'source-1',
        sourceTitle: 'Source',
        sourceType: 'markdown',
      },
      deps
    );

    expect(onEvent).toHaveBeenCalledWith({
      type: 'ingestion_complete',
      conceptCount: 3,
      relationshipCount: 4,
    });
  });

  it('marks the ingestion run failed when LGS is disabled', async () => {
    serverEnv.LGS_ENABLED = 'false';
    const deps = createDeps();

    await expect(
      runSourceIngestion(
        {
          content: 'Source text',
          ownerId: 'owner-1',
          projectId: 'project-1',
          sourceId: 'source-1',
          sourceTitle: 'Source',
          sourceType: 'markdown',
        },
        deps
      )
    ).rejects.toThrow('LGS ingestion is disabled.');

    expect(deps.ingestionRunRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'LGS ingestion is disabled.'
    );
  });

  it('marks the ingestion run failed when ownerId is missing', async () => {
    const deps = createDeps();

    await expect(
      runSourceIngestion(
        {
          content: 'Source text',
          projectId: 'project-1',
          sourceId: 'source-1',
          sourceTitle: 'Source',
          sourceType: 'markdown',
        },
        deps
      )
    ).rejects.toThrow('ownerId is required for LGS ingestion');

    expect(deps.ingestionRunRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'ownerId is required for LGS ingestion'
    );
  });

  it('marks the ingestion run failed when the LGS service is not configured', async () => {
    const deps = createDeps();

    await expect(
      runSourceIngestion(
        {
          content: 'Source text',
          ownerId: 'owner-1',
          projectId: 'project-1',
          sourceId: 'source-1',
          sourceTitle: 'Source',
          sourceType: 'markdown',
        },
        deps
      )
    ).rejects.toThrow('LGS service is not configured');

    expect(deps.ingestionRunRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'LGS service is not configured'
    );
  });
});

function createDeps() {
  return {
    ingestionRunRepository: {
      create: vi.fn().mockResolvedValue({ id: 'run-1' }),
      findLatestByProject: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    },
  } as unknown as Parameters<typeof runSourceIngestion>[1];
}
