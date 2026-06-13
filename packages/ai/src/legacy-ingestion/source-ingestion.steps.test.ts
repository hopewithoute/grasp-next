/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest';
import {
  embedAndSaveStep,
  initializeRunStep,
  normalizeAndChunkStep,
  prepareLinkCandidatesStep,
} from './source-ingestion.steps';

describe('Source Ingestion Steps', () => {
  describe('initializeRunStep', () => {
    it('creates an ingestion run and returns input untouched', async () => {
      const mockRepo = {
        markCompleted: vi.fn(),
        markFailed: vi.fn(),
      };
      const requestContext = {
        get: vi.fn((key) => {
          if (key === 'ingestionRunRepository') return mockRepo;
          return null;
        }),
      };

      const setStateMock = vi.fn();

      const result = await initializeRunStep.execute({
        inputData: {
          ingestionRunId: 'run-123',
          projectId: 'proj-1',
          sourceId: 'src-1',
          sourceTitle: 'Test',
          content: 'Content',
        },
        requestContext,
        state: {},
        setState: setStateMock,
      } as any);

      expect(setStateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-123',
          projectId: 'proj-1',
          sourceId: 'src-1',
        })
      );

      expect((result as any).content).toBe('Content');
    });
  });

  describe('normalizeAndChunkStep', () => {
    it('normalizes and chunks content correctly', async () => {
      const mockKbRepo = {
        upsertSourcePassages: vi.fn().mockResolvedValue({}),
      };

      const requestContext = {
        get: vi.fn((key) => {
          if (key === 'knowledgebaseRepository') return mockKbRepo;
          return null;
        }),
      };

      const result = await normalizeAndChunkStep.execute({
        inputData: {
          content: 'This is some markdown content.\n\nIt has multiple paragraphs.',
          sourceTitle: 'Test Title',
        },
        requestContext,
        state: { projectId: 'proj-1', sourceId: 'src-1' },
        setState: vi.fn(),
      } as any);

      expect(mockKbRepo.upsertSourcePassages).toHaveBeenCalled();
      expect((result as any).chunks.length).toBeGreaterThan(0);
      expect((result as any).chunks[0].text).toContain('This is some markdown content.');
    });

    it('returns empty chunks if content is empty', async () => {
      const result = await normalizeAndChunkStep.execute({
        inputData: {
          content: '   ',
          sourceTitle: 'Test Title',
        },
        requestContext: { get: vi.fn() },
        state: { projectId: 'proj-1', sourceId: 'src-1' },
        setState: vi.fn(),
      } as any);

      expect((result as any).chunks).toEqual([]);
    });
  });

  describe('extractChunkStep', () => {
    it('calls AI port to extract concepts', async () => {
      const mockAiPort = {
        extractConceptsFromChunk: vi.fn().mockResolvedValue({
          concepts: [
            { conceptKey: 'test', name: 'Test', definition: 'A test concept', type: 'entity' },
          ],
          relationships: [],
          relationClaims: [],
          droppedConceptKeys: [],
          droppedRefCount: 0,
        }),
      };

      const requestContext = {
        get: vi.fn((key) => {
          if (key === 'aiPort') return mockAiPort;
          return null;
        }),
      };

      const result = await (
        await import('./source-ingestion.steps')
      ).extractChunkStep.execute({
        inputData: {
          chunk: {
            index: 0,
            blockIndexes: [0],
            text: 'Test',
            tokens: 1,
            blocks: [{ id: 'b1', text: 'Test' }],
          },
          totalChunks: 1,
        },
        requestContext,
        state: { projectId: 'proj-1', sourceId: 'src-1' },
        setState: vi.fn(),
      } as any);

      const output = result as { concepts: unknown[] };

      expect(mockAiPort.extractConceptsFromChunk).toHaveBeenCalled();
      expect(output.concepts.length).toBe(1);
    });
  });

  describe('mergeExtractionsStep', () => {
    it('merges an array of extractions into one draft', async () => {
      const result = await (
        await import('./source-ingestion.steps')
      ).mergeExtractionsStep.execute({
        inputData: {
          extractions: [
            {
              concepts: [{ conceptKey: 'a' }],
              relationships: [],
              relationClaims: [],
              droppedConceptKeys: [],
              droppedRefCount: 0,
            },
            {
              concepts: [{ conceptKey: 'b' }],
              relationships: [],
              relationClaims: [],
              droppedConceptKeys: [],
              droppedRefCount: 0,
            },
          ],
        },
        state: { totalDroppedRefs: 0, totalDroppedConceptKeys: [] },
        setState: vi.fn(),
      } as any);

      expect((result as any).draft.concepts).toHaveLength(2);
    });
  });

  describe('prepareLinkCandidatesStep', () => {
    it('builds candidates and returns them for the linking workflow', async () => {
      const mockKbRepo = {
        getConceptContext: vi.fn().mockResolvedValue(null),
        searchConceptsForIngestion: vi.fn().mockResolvedValue([]),
      };

      const mockDraft = {
        concepts: [
          {
            conceptKey: 'test-concept',
            name: 'Test',
            definition: 'A test concept',
            sourceRefs: [],
          },
        ],
        relationships: [],
        relationClaims: [],
      };

      const result = (await prepareLinkCandidatesStep.execute({
        inputData: { draft: mockDraft },
        requestContext: new Map([['knowledgebaseRepository', mockKbRepo]]) as any,
        runId: 'run-id',
        setState: vi.fn(),
        state: { projectId: 'project-1' },
        suspend: vi.fn(),
      } as any)) as any;

      expect(result.candidates).toBeDefined();
      expect(result.extraction).toEqual(mockDraft);
      expect(result.useModel).toBe(true);
    });
  });

  describe('embedAndSaveStep', () => {
    it('embeds concepts and merges output', async () => {
      const mockKbRepo = {
        mergeIngestionOutput: vi.fn().mockResolvedValue(undefined),
      };
      const mockAiPort = {
        embedConcepts: vi.fn().mockResolvedValue({
          embeddingsByKey: { c1: [0.1, 0.2] },
          metadata: { status: 'completed' },
        }),
      };
      const mockRunRepo = {
        markCompleted: vi.fn().mockResolvedValue(undefined),
      };

      const requestContext = {
        get: vi.fn((key) => {
          if (key === 'knowledgebaseRepository') return mockKbRepo;
          if (key === 'aiPort') return mockAiPort;
          if (key === 'ingestionRunRepository') return mockRunRepo;
          return null;
        }),
      };

      const result = await embedAndSaveStep.execute({
        context: {
          machineContext: {},
          stepResults: {},
          attempts: 0,
          triggerData: {},
        },
        inputData: {
          patchedExtraction: {
            concepts: [
              { conceptKey: 'c1', name: 'Concept 1', definition: 'Def 1', sourceRefs: [] },
            ],
            relationships: [],
            relationClaims: [],
          },
          trace: { appliedLinks: [] },
        },
        requestContext,
        state: {
          projectId: 'proj-1',
          sourceId: 'src-1',
          runId: 'run-123',
          chunkCount: 1,
          totalDroppedRefs: 0,
          totalDroppedConceptKeys: [],
        },
      } as any);

      expect(mockAiPort.embedConcepts).toHaveBeenCalled();
      expect(mockKbRepo.mergeIngestionOutput).toHaveBeenCalled();
      expect(mockRunRepo.markCompleted).toHaveBeenCalled();
      expect((result as any).success).toBe(true);
    });
  });
});
