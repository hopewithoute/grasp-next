import 'server-only';
import type { IngestionRunRepository, IngestionStreamEvent } from '@grasp/domain';
import { serverEnv } from './env';
import type { LgsService } from './lgs-service';

export type SourceIngestionDeps = {
  ingestionRunRepository: IngestionRunRepository;
  lgsService?: LgsService | null;
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
    if (serverEnv.LGS_ENABLED !== 'true') {
      throw new Error('LGS ingestion is disabled.');
    }
    if (!input.ownerId) {
      throw new Error('ownerId is required for LGS ingestion');
    }
    if (!deps.lgsService) {
      throw new Error('LGS service is not configured');
    }

    const result = await deps.lgsService.indexSourceForOwner({
      content: input.content,
      ownerId: input.ownerId,
      projectId: input.projectId,
      sourceId: input.sourceId,
      sourceTitle: input.sourceTitle,
      sourceType: input.sourceType,
    });

    await deps.ingestionRunRepository.markCompleted(ingestionRun.id, {
      lgs: result,
    });

    input.onEvent?.({
      type: 'ingestion_complete',
      conceptCount: result.termCount,
      relationshipCount: result.chunkTermCount,
    });

    return result;
  } catch (error) {
    await deps.ingestionRunRepository.markFailed(
      ingestionRun.id,
      error instanceof Error ? error.message : 'Unknown LGS ingestion error'
    );
    throw error;
  }
}
