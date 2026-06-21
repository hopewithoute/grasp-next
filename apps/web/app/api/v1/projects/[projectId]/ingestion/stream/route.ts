import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { requiredString, safeParse, v } from '@grasp/domain';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { runSourceIngestion, type IngestionStreamEvent } from '@/server/source-ingestion-runner';
import { parseJsonRequest, validationErrorResponse } from '../../../../http';

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

  const bodyResult = await parseJsonRequest(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const ingestionStreamRequestBodySchema = v.object({
    sourceId: requiredString,
    sourceTitle: v.optional(v.string()),
    sourceType: v.optional(v.picklist(['markdown', 'text', 'web'])),
    content: v.pipe(v.string(), v.minLength(1)),
  });

  const parsed = safeParse(ingestionStreamRequestBodySchema, bodyResult.value);
  if (!parsed.success) {
    const errorResponse = validationErrorResponse(parsed);
    if (errorResponse) return errorResponse;
    return new Response('Invalid request body.', { status: 400 });
  }

  const body = parsed.output;

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
            onEvent: (event) => send(event),
            ownerId: actor.id,
            projectId: project.id,
            sourceId: body.sourceId,
            sourceTitle: body.sourceTitle || body.sourceId,
            sourceType: body.sourceType || 'web',
          },
          deps
        );
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
