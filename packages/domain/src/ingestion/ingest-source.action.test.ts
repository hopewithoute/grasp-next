import { describe, expect, it, vi } from 'vitest';
import { ingestSourceAction, type IngestionRunRepositoryPort, type KnowledgebaseRepositoryPort, type IngestionStreamEvent } from './ingest-source.action';
import type { IngestionAiPort } from './ingestion-ai.port';

describe('ingestSourceAction', () => {
  it('successfully extracts and links concepts from a markdown document', async () => {
    // 1. Setup mocks
    const createRun = vi.fn(() => Promise.resolve({ id: 'run-123' }));
    const markRunCompleted = vi.fn(() => Promise.resolve(undefined));
    const markRunFailed = vi.fn(() => Promise.resolve(undefined));

    const mockIngestionRunRepo = {
      create: createRun,
      markCompleted: markRunCompleted,
      markFailed: markRunFailed,
    } as unknown as IngestionRunRepositoryPort;

    const upsertSourcePassages = vi.fn(async () => undefined);
    const searchConceptsForIngestion = vi.fn(async () => []);
    const getConceptContext = vi.fn(async () => null);
    const mergeIngestionOutput = vi.fn(async () => undefined);

    const mockKnowledgebaseRepo = {
      upsertSourcePassages,
      searchConceptsForIngestion,
      getConceptContext,
      mergeIngestionOutput,
    } as unknown as KnowledgebaseRepositoryPort;

    const extractConceptsFromChunk = vi.fn(async () => ({
      concepts: [{ conceptKey: 'test-concept', name: 'Test Concept', definition: 'A test concept', sourceRefs: [] }],
      relationships: [],
      relationClaims: [],
      droppedConceptKeys: [],
      droppedRefCount: 0,
    }));
    const evaluateLinkCandidates = vi.fn(async () => ({
      reviewedLinks: [],
      acceptedLinks: [],
      rejectedLinks: [],
      policyResults: [],
      patchedExtraction: { concepts: [], relationships: [], relationClaims: [] },
      trace: {},
    }));
    const embedConcepts = vi.fn(async () => ({
      embeddingsByKey: { 'test-concept': [0.1, 0.2] },
      metadata: { status: 'completed' },
    }));

    const mockAiPort = {
      extractConceptsFromChunk,
      evaluateLinkCandidates,
      embedConcepts,
    } as unknown as IngestionAiPort;

    const deps = {
      ingestionRunRepository: mockIngestionRunRepo,
      knowledgebaseRepository: mockKnowledgebaseRepo,
      aiPort: mockAiPort,
    };

    const events: IngestionStreamEvent[] = [];
    const emit = (e: IngestionStreamEvent) => events.push(e);

    // 2. Execute
    await ingestSourceAction(
      {
        projectId: 'proj-1',
        sourceId: 'src-1',
        sourceTitle: 'Test Source',
        content: '# Hello\nThis is a test block of text to process.',
        onEvent: emit,
      },
      deps
    );

    // 3. Verify
    expect(createRun.mock.calls.length).toBe(1);
    const createArgs = createRun.mock.calls[0]?.[0] as { projectId: string; sourceId: string } | undefined;
    expect(createArgs?.projectId).toBe('proj-1');
    expect(createArgs?.sourceId).toBe('src-1');

    expect(upsertSourcePassages.mock.calls.length).toBe(1);
    expect(extractConceptsFromChunk.mock.calls.length).toBe(1);
    expect(evaluateLinkCandidates.mock.calls.length).toBe(1);
    expect(embedConcepts.mock.calls.length).toBe(1);
    expect(mergeIngestionOutput.mock.calls.length).toBe(1);
    
    expect(markRunCompleted.mock.calls.length).toBe(1);
    expect(markRunCompleted.mock.calls[0]?.[0]).toBe('run-123');

    // Verify events were emitted
    const startedEvent = events.find(e => e.type === 'ingestion_started');
    expect(startedEvent).toBeTruthy();
    const completeEvent = events.find(e => e.type === 'ingestion_complete');
    expect(completeEvent).toBeTruthy();
  });

  it('safely handles an empty document without invoking AI', async () => {
    // 1. Setup mocks
    const markRunCompleted = vi.fn(() => Promise.resolve(undefined));
    
    const mockIngestionRunRepo = {
      create: vi.fn(async () => ({ id: 'run-123' })),
      markCompleted: markRunCompleted,
      markFailed: vi.fn(async () => undefined),
    } as unknown as IngestionRunRepositoryPort;

    const mockKnowledgebaseRepo = {
      upsertSourcePassages: vi.fn(async () => undefined),
      searchConceptsForIngestion: vi.fn(async () => []),
      getConceptContext: vi.fn(async () => null),
      mergeIngestionOutput: vi.fn(async () => undefined),
    } as unknown as KnowledgebaseRepositoryPort;

    const extractConceptsFromChunk = vi.fn(async () => { throw new Error('Should not be called'); });
    const evaluateLinkCandidates = vi.fn(async () => { throw new Error('Should not be called'); });

    const mockAiPort = {
      extractConceptsFromChunk,
      evaluateLinkCandidates,
      embedConcepts: vi.fn(async () => { throw new Error('Should not be called'); }),
    } as unknown as IngestionAiPort;

    const deps = {
      ingestionRunRepository: mockIngestionRunRepo,
      knowledgebaseRepository: mockKnowledgebaseRepo,
      aiPort: mockAiPort,
    };

    // 2. Execute
    await ingestSourceAction(
      {
        projectId: 'proj-1',
        sourceId: 'src-1',
        sourceTitle: 'Empty Source',
        content: '   \n   ', // whitespace only
      },
      deps
    );

    // 3. Verify
    expect(extractConceptsFromChunk.mock.calls.length).toBe(0);
    expect(evaluateLinkCandidates.mock.calls.length).toBe(0);
    expect(markRunCompleted.mock.calls.length).toBe(1);
  });

  it('marks the run as failed and re-throws if AI extraction throws', async () => {
    // 1. Setup mocks
    const markRunFailed = vi.fn(() => Promise.resolve(undefined));
    const markRunCompleted = vi.fn(() => Promise.resolve(undefined));

    const mockIngestionRunRepo = {
      create: vi.fn(async () => ({ id: 'run-fail' })),
      markCompleted: markRunCompleted,
      markFailed: markRunFailed,
    } as unknown as IngestionRunRepositoryPort;

    const mockKnowledgebaseRepo = {
      upsertSourcePassages: vi.fn(async () => undefined),
      searchConceptsForIngestion: vi.fn(async () => []),
      getConceptContext: vi.fn(async () => null),
      mergeIngestionOutput: vi.fn(async () => undefined),
    } as unknown as KnowledgebaseRepositoryPort;

    const mockAiPort = {
      extractConceptsFromChunk: vi.fn(async () => { throw new Error('AI failed'); }),
      evaluateLinkCandidates: vi.fn(async () => { throw new Error('Should not be called'); }),
      embedConcepts: vi.fn(async () => { throw new Error('Should not be called'); }),
    } as unknown as IngestionAiPort;

    const deps = {
      ingestionRunRepository: mockIngestionRunRepo,
      knowledgebaseRepository: mockKnowledgebaseRepo,
      aiPort: mockAiPort,
    };

    // 2. Execute & 3. Verify
    await expect(() => ingestSourceAction(
        {
          projectId: 'proj-fail',
          sourceId: 'src-fail',
          sourceTitle: 'Failing Source',
          content: '# Valid text\nTo extract.',
        },
        deps
      )).rejects.toThrow(/AI failed/);

    expect(markRunFailed.mock.calls.length).toBe(1);
    const failArgs = markRunFailed.mock.calls[0];
    expect(failArgs?.[0]).toBe('run-fail');
    expect(failArgs?.[1]).toBe('AI failed');
    expect(markRunCompleted.mock.calls.length).toBe(0);
  });
});
