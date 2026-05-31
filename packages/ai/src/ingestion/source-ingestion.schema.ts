import { z } from 'zod';

export const ingestionWorkflowInputSchema = z.object({
  projectId: z.string(),
  sourceId: z.string(),
  sourceTitle: z.string(),
  content: z.string(),
});

export type IngestionWorkflowInput = z.infer<typeof ingestionWorkflowInputSchema>;

export const chunkSchema = z.object({
  index: z.number(),
  blockIndexes: z.array(z.number()),
  text: z.string(),
  tokens: z.number(),
});

export type WorkflowChunk = z.infer<typeof chunkSchema>;

export const ingestionWorkflowContextSchema = z.object({
  ingestionRunRepository: z.any(),
  knowledgebaseRepository: z.any(),
  aiPort: z.any(),
});

export type IngestionWorkflowContext = z.infer<typeof ingestionWorkflowContextSchema>;
