import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { ingestionWorkflowInputSchema, type WorkflowChunk } from './source-ingestion.schema';
import {
  initializeRunStep,
  normalizeAndChunkStep,
  extractChunkStep,
  mergeExtractionsStep,
  prepareLinkCandidatesStep,
  embedAndSaveStep,
  ingestionStateSchema,
} from './source-ingestion.steps';
import { sourceLinkingWorkflow } from './source-linking.workflow';

export const processChunkWorkflow = createWorkflow({
  id: 'process-chunk-workflow',
  inputSchema: z.object({ chunk: z.any(), totalChunks: z.number() }),
  outputSchema: z.any(),
})
  .then(extractChunkStep)
  .commit();

export const sourceIngestionWorkflow = createWorkflow({
  id: 'source-ingestion-workflow',
  inputSchema: ingestionWorkflowInputSchema,
  outputSchema: z.object({ success: z.boolean() }),
  stateSchema: ingestionStateSchema,
})
  .then(initializeRunStep)
  .then(normalizeAndChunkStep)
  .map(async ({ inputData }) =>
    inputData.chunks.map((chunk: WorkflowChunk) => ({
      chunk,
      totalChunks: inputData.chunks.length,
    }))
  )
  .foreach(processChunkWorkflow, { concurrency: 3 })
  .map(async ({ inputData }) => ({ extractions: inputData }))
  .then(mergeExtractionsStep)
  .then(prepareLinkCandidatesStep)
  .then(sourceLinkingWorkflow)
  .then(embedAndSaveStep)
  .commit();

