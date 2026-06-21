import 'server-only';
import type { IngestionRunRepository, IngestionStreamEvent } from '@grasp/domain';
import type { EvidenceKbService } from './evidence-kb-service';

export type SourceIngestionDeps = {
  evidenceKbService?: EvidenceKbService | null;
  ingestionRunRepository: IngestionRunRepository;
};

export type { IngestionStreamEvent };

export async function runSourceIngestion(
  input: {
    content: string;
    onEvent?: (event: IngestionStreamEvent) => void;
    ownerId?: string;
    projectId: string;
    sourceId: string;
    sourceTitle: string;
    sourceType: 'markdown' | 'text' | 'web';
  },
  deps: SourceIngestionDeps
) {
  const ingestionRun = await deps.ingestionRunRepository.create({
    projectId: input.projectId,
    sourceId: input.sourceId,
  });

  try {
    if (!input.ownerId) {
      throw new Error('ownerId is required for ingestion');
    }
    if (!deps.evidenceKbService) {
      throw new Error('Evidence KB service is not configured');
    }

    const result = await deps.evidenceKbService.ingestSourceForOwner({
      content: input.content,
      ownerId: input.ownerId,
      projectId: input.projectId,
      sourceId: input.sourceId,
      sourceTitle: input.sourceTitle,
      sourceType: input.sourceType,
    });

    await deps.ingestionRunRepository.markCompleted(ingestionRun.id, {
      evidenceKb: result,
    });

    input.onEvent?.({
      type: 'evidence_ingestion_complete',
      passageCount: result.passageCount,
      sourceStatus: 'candidate',
      warningCount: result.warningCount,
    });

    return result;
  } catch (error) {
    await deps.ingestionRunRepository.markFailed(
      ingestionRun.id,
      error instanceof Error ? error.message : 'Unknown source ingestion error'
    );
    throw error;
  }
}
