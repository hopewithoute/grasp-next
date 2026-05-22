import { revalidatePath } from 'next/cache';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { getActor } from '@/server/actor';
import {
  runSourceIngestion,
  type IngestionStreamEvent,
} from '@/server/source-ingestion-runner';
import { createProjectDeps } from '@/server/project-deps';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const actor = await getActor();

  if (!actor) {
    return new Response('Unauthorized.', { status: 401 });
  }

  const { projectId } = await context.params;
  const deps = createProjectDeps();
  const project = await deps.projectRepository.findByIdForOwner(projectId, actor.id);

  if (!project) {
    return new Response('Project not found.', { status: 404 });
  }

  const body = (await request.json()) as {
    sourceId: string;
    sourceTitle: string;
    sourceType: 'markdown' | 'text';
    content: string;
  };

  if (!body.sourceId || !body.content) {
    return new Response('sourceId and content are required.', { status: 400 });
  }

  const stream = createUIMessageStream({
    async execute({ writer }) {
      const send = (event: IngestionStreamEvent) => {
        writer.write({
          type: 'data-ingestion',
          data: event,
          transient: true,
        });
      };

      try {
        await runSourceIngestion(
          {
            content: body.content,
            onEvent: send,
            projectId: project.id,
            sourceId: body.sourceId,
            sourceTitle: body.sourceTitle ?? 'Untitled',
            sourceType: body.sourceType ?? 'markdown',
          },
          deps
        );

        revalidatePath(`/dashboard/projects/${project.id}`);
      } catch (error) {
        send({
          type: 'ingestion_failed',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
