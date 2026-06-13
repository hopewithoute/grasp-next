import { createWorkflow } from '@mastra/core/workflows';
import { v } from '@grasp/domain';
import { ingestionWorkflowInputSchema, type WorkflowChunk } from './source-ingestion.schema';
import {
  embedAndSaveStep,
  extractChunkOutputSchema,
  extractChunkStep,
  ingestionStateSchema,
  initializeRunStep,
  mergeExtractionsStep,
  normalizeAndChunkStep,
  prepareLinkCandidatesStep,
} from './source-ingestion.steps';
import { sourceLinkingWorkflow } from './source-linking.workflow';

export const processChunkWorkflow = createWorkflow({
  id: 'process-chunk-workflow',
  inputSchema: v.object({ chunk: v.any(), totalChunks: v.number() }),
  outputSchema: extractChunkOutputSchema,
})
  .then(extractChunkStep)
  .commit();

export const sourceIngestionWorkflow = createWorkflow({
  id: 'source-ingestion-workflow',
  inputSchema: ingestionWorkflowInputSchema,
  outputSchema: v.object({ success: v.boolean() }),
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
