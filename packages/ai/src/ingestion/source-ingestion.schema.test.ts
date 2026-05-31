import { describe, it, expect } from 'vitest';
import { ingestionWorkflowInputSchema, ingestionWorkflowContextSchema } from './source-ingestion.schema';

describe('Source Ingestion Schema', () => {
  describe('ingestionWorkflowInputSchema', () => {
    it('validates correct input', () => {
      const result = ingestionWorkflowInputSchema.safeParse({
        projectId: 'proj-123',
        sourceId: 'src-123',
        sourceTitle: 'Test Title',
        content: 'Test content',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid input', () => {
      const result = ingestionWorkflowInputSchema.safeParse({
        projectId: 'proj-123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ingestionWorkflowContextSchema', () => {
    it('validates context with required repositories', () => {
      const mockRepo = {
        ingestionRunRepository: {} as unknown,
        knowledgebaseRepository: {} as unknown,
        aiPort: {} as unknown,
      };

      const result = ingestionWorkflowContextSchema.safeParse(mockRepo);
      expect(result.success).toBe(true);
    });
  });
});
