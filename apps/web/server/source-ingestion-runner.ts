import 'server-only';

import { ingestSourceAction, type IngestionStreamEvent } from '@grasp/domain';
import { IngestionAiAdapter } from '@grasp/ai/ingestion';
import type { createProjectDeps } from './project-deps';

type ProjectDeps = ReturnType<typeof createProjectDeps>;

export type { IngestionStreamEvent };

export async function runSourceIngestion(
  input: {
    content: string;
    onEvent?: (event: IngestionStreamEvent) => void;
    projectId: string;
    sourceId: string;
    sourceTitle: string;
    sourceType: 'markdown' | 'text';
  },
  deps: ProjectDeps
) {
  const aiAdapter = new IngestionAiAdapter(deps.knowledgebaseRepository);

  return ingestSourceAction(
    {
      projectId: input.projectId,
      sourceId: input.sourceId,
      sourceTitle: input.sourceTitle,
      content: input.content,
      onEvent: input.onEvent,
    },
    {
      aiPort: aiAdapter,
      ingestionRunRepository: deps.ingestionRunRepository,
      knowledgebaseRepository: deps.knowledgebaseRepository,
    }
  );
}
