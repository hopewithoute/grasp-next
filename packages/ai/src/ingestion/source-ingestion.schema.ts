import { v } from '@grasp/domain';

export const ingestionWorkflowInputSchema = v.object({
  projectId: v.string(),
  sourceId: v.string(),
  sourceTitle: v.string(),
  content: v.string(),
});

export type IngestionWorkflowInput = v.InferOutput<typeof ingestionWorkflowInputSchema>;

export const chunkSchema = v.object({
  index: v.number(),
  blockIndexes: v.array(v.number()),
  text: v.string(),
  tokens: v.number(),
});

export type WorkflowChunk = v.InferOutput<typeof chunkSchema>;

export const ingestionWorkflowContextSchema = v.object({
  ingestionRunRepository: v.any(),
  knowledgebaseRepository: v.any(),
  aiPort: v.any(),
});

export type IngestionWorkflowContext = v.InferOutput<typeof ingestionWorkflowContextSchema>;
