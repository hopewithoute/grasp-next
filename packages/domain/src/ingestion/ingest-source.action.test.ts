import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { ingestSourceAction, type IngestionRunRepositoryPort, type KnowledgebaseRepositoryPort, type IngestionStreamEvent } from './ingest-source.action';
import type { IngestionAiPort } from './ingestion-ai.port';

describe('ingestSourceAction', () => {
  it('successfully extracts and links concepts from a markdown document', async () => {
    // 1. Setup mocks
    const createRun = mock.fn((..._args: unknown[]) => Promise.resolve({ id: 'run-123' }));
    const markRunCompleted = mock.fn((..._args: unknown[]) => Promise.resolve(undefined));
    const markRunFailed = mock.fn((..._args: unknown[]) => Promise.resolve(undefined));

    const mockIngestionRunRepo = {
      create: createRun,
      markCompleted: markRunCompleted,
      markFailed: markRunFailed,
    } as unknown as IngestionRunRepositoryPort;

    const upsertSourcePassages = mock.fn(async () => undefined);
    const searchConceptsForIngestion = mock.fn(async () => []);
    const getConceptContext = mock.fn(async () => null);
    const mergeIngestionOutput = mock.fn(async () => undefined);

    const mockKnowledgebaseRepo = {
      upsertSourcePassages,
      searchConceptsForIngestion,
      getConceptContext,
      mergeIngestionOutput,
    } as unknown as KnowledgebaseRepositoryPort;

    const extractConceptsFromChunk = mock.fn(async () => ({
      concepts: [{ conceptKey: 'test-concept', name: 'Test Concept', definition: 'A test concept', sourceRefs: [] }],
      relationships: [],
      relationClaims: [],
      droppedConceptKeys: [],
      droppedRefCount: 0,
    }));
    const evaluateLinkCandidates = mock.fn(async () => ({
      reviewedLinks: [],
      acceptedLinks: [],
      rejectedLinks: [],
      policyResults: [],
      patchedExtraction: { concepts: [], relationships: [], relationClaims: [] },
      trace: {},
    }));
    const embedConcepts = mock.fn(async () => ({
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
    assert.equal(createRun.mock.callCount(), 1);
    const createArgs = createRun.mock.calls[0]?.arguments[0] as { projectId: string; sourceId: string } | undefined;
    assert.equal(createArgs?.projectId, 'proj-1');
    assert.equal(createArgs?.sourceId, 'src-1');

    assert.equal(upsertSourcePassages.mock.callCount(), 1);
    assert.equal(extractConceptsFromChunk.mock.callCount(), 1);
    assert.equal(evaluateLinkCandidates.mock.callCount(), 1);
    assert.equal(embedConcepts.mock.callCount(), 1);
    assert.equal(mergeIngestionOutput.mock.callCount(), 1);
    
    assert.equal(markRunCompleted.mock.callCount(), 1);
    assert.equal(markRunCompleted.mock.calls[0]?.arguments[0], 'run-123');

    // Verify events were emitted
    const startedEvent = events.find(e => e.type === 'ingestion_started');
    assert.ok(startedEvent);
    const completeEvent = events.find(e => e.type === 'ingestion_complete');
    assert.ok(completeEvent);
  });

  it('safely handles an empty document without invoking AI', async () => {
    // 1. Setup mocks
    const markRunCompleted = mock.fn((..._args: unknown[]) => Promise.resolve(undefined));
    
    const mockIngestionRunRepo = {
      create: mock.fn(async () => ({ id: 'run-123' })),
      markCompleted: markRunCompleted,
      markFailed: mock.fn(async () => undefined),
    } as unknown as IngestionRunRepositoryPort;

    const mockKnowledgebaseRepo = {
      upsertSourcePassages: mock.fn(async () => undefined),
      searchConceptsForIngestion: mock.fn(async () => []),
      getConceptContext: mock.fn(async () => null),
      mergeIngestionOutput: mock.fn(async () => undefined),
    } as unknown as KnowledgebaseRepositoryPort;

    const extractConceptsFromChunk = mock.fn(async () => { throw new Error('Should not be called'); });
    const evaluateLinkCandidates = mock.fn(async () => { throw new Error('Should not be called'); });

    const mockAiPort = {
      extractConceptsFromChunk,
      evaluateLinkCandidates,
      embedConcepts: mock.fn(async () => { throw new Error('Should not be called'); }),
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
    assert.equal(extractConceptsFromChunk.mock.callCount(), 0);
    assert.equal(evaluateLinkCandidates.mock.callCount(), 0);
    assert.equal(markRunCompleted.mock.callCount(), 1);
  });

  it('marks the run as failed and re-throws if AI extraction throws', async () => {
    // 1. Setup mocks
    const markRunFailed = mock.fn((..._args: unknown[]) => Promise.resolve(undefined));
    const markRunCompleted = mock.fn((..._args: unknown[]) => Promise.resolve(undefined));

    const mockIngestionRunRepo = {
      create: mock.fn(async () => ({ id: 'run-fail' })),
      markCompleted: markRunCompleted,
      markFailed: markRunFailed,
    } as unknown as IngestionRunRepositoryPort;

    const mockKnowledgebaseRepo = {
      upsertSourcePassages: mock.fn(async () => undefined),
      searchConceptsForIngestion: mock.fn(async () => []),
      getConceptContext: mock.fn(async () => null),
      mergeIngestionOutput: mock.fn(async () => undefined),
    } as unknown as KnowledgebaseRepositoryPort;

    const mockAiPort = {
      extractConceptsFromChunk: mock.fn(async () => { throw new Error('AI failed'); }),
      evaluateLinkCandidates: mock.fn(async () => { throw new Error('Should not be called'); }),
      embedConcepts: mock.fn(async () => { throw new Error('Should not be called'); }),
    } as unknown as IngestionAiPort;

    const deps = {
      ingestionRunRepository: mockIngestionRunRepo,
      knowledgebaseRepository: mockKnowledgebaseRepo,
      aiPort: mockAiPort,
    };

    // 2. Execute & 3. Verify
    await assert.rejects(
      () => ingestSourceAction(
        {
          projectId: 'proj-fail',
          sourceId: 'src-fail',
          sourceTitle: 'Failing Source',
          content: '# Valid text\nTo extract.',
        },
        deps
      ),
      /AI failed/
    );

    assert.equal(markRunFailed.mock.callCount(), 1);
    const failArgs = markRunFailed.mock.calls[0]?.arguments;
    assert.equal(failArgs?.[0], 'run-fail');
    assert.equal(failArgs?.[1], 'AI failed');
    assert.equal(markRunCompleted.mock.callCount(), 0);
  });
});
