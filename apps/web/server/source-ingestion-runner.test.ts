import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runSourceIngestion } from './source-ingestion-runner';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  createRun: vi.fn(),
  embedConcepts: vi.fn(),
  extractConceptsFromChunk: vi.fn(),
}));

vi.mock('@grasp/ai/ingestion', () => ({
  IngestionAiAdapter: vi.fn().mockImplementation(() => ({
    embedConcepts: mocks.embedConcepts,
    extractConceptsFromChunk: mocks.extractConceptsFromChunk,
  })),
  sourceIngestionWorkflow: {
    createRun: mocks.createRun,
  },
}));

describe('runSourceIngestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the ingestion run before starting the workflow and passes its id', async () => {
    const start = vi.fn().mockResolvedValue({ success: true });
    mocks.createRun.mockResolvedValue({ start });

    const deps = createDeps();

    await runSourceIngestion(
      {
        content: 'Fetched webpage text',
        projectId: 'project-1',
        sourceId: 'source-1',
        sourceTitle: 'Web Source',
        sourceType: 'web',
      },
      deps
    );

    expect(deps.ingestionRunRepository.create).toHaveBeenCalledWith({
      projectId: 'project-1',
      sourceId: 'source-1',
    });
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        inputData: expect.objectContaining({
          ingestionRunId: 'run-1',
          projectId: 'project-1',
          sourceId: 'source-1',
        }),
      })
    );
  });

  it('marks the created ingestion run failed when the workflow fails', async () => {
    const start = vi.fn().mockRejectedValue(new Error('provider unavailable'));
    mocks.createRun.mockResolvedValue({ start });

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
    ).rejects.toThrow('provider unavailable');

    expect(deps.ingestionRunRepository.markFailed).toHaveBeenCalledWith(
      'run-1',
      'provider unavailable'
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
    knowledgebaseRepository: {},
  } as Parameters<typeof runSourceIngestion>[1];
}
