import { describe, expect, it } from 'vitest';
import { safeParse } from '@grasp/domain';
import {
  ingestionWorkflowContextSchema,
  ingestionWorkflowInputSchema,
} from './source-ingestion.schema';

describe('Source Ingestion Schema', () => {
  describe('ingestionWorkflowInputSchema', () => {
    it('validates correct input', () => {
      const result = safeParse(ingestionWorkflowInputSchema, {
        projectId: 'proj-123',
        sourceId: 'src-123',
        sourceTitle: 'Test Title',
        content: 'Test content',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid input', () => {
      const result = safeParse(ingestionWorkflowInputSchema, {
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

      const result = safeParse(ingestionWorkflowContextSchema, mockRepo);
      expect(result.success).toBe(true);
    });
  });
});
