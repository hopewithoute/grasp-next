import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runSourceIngestion } from './source-ingestion-runner';

vi.mock('server-only', () => ({}));

describe('runSourceIngestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes ingestion through Evidence KB', async () => {
    const deps = createDeps();
    const evidenceKbService = {
      ingestSourceForOwner: vi.fn().mockResolvedValue({
        ingestionRunId: 'evidence-run-1',
        passageCount: 2,
        sourceId: 'kb-source-1',
        status: 'completed',
        warningCount: 1,
      }),
    };
    deps.evidenceKbService = evidenceKbService as never;

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

    expect(evidenceKbService.ingestSourceForOwner).toHaveBeenCalledWith({
      content: 'Source text',
      ownerId: 'owner-1',
      projectId: 'project-1',
      sourceId: 'source-1',
      sourceTitle: 'Source',
      sourceType: 'markdown',
    });
  });

  it('emits an evidence completion event', async () => {
    const deps = createDeps();
    deps.evidenceKbService = {
      ingestSourceForOwner: vi.fn().mockResolvedValue({
        ingestionRunId: 'evidence-run-1',
        passageCount: 2,
        sourceId: 'kb-source-1',
        status: 'completed',
        warningCount: 1,
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
      type: 'evidence_ingestion_complete',
      passageCount: 2,
      sourceStatus: 'candidate',
      warningCount: 1,
    });
  });

  it('marks the ingestion run failed when Evidence KB is not configured', async () => {
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
    ).rejects.toThrow('Evidence KB service is not configured');
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
    ).rejects.toThrow('ownerId is required for ingestion');
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
