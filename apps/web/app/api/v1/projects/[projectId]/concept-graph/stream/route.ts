import { revalidatePath } from 'next/cache';
import {
  ARTIFACT_STATUS,
  ARTIFACT_TYPE,
  PROJECT_STATUS,
  requestConceptRevision,
} from '@grasp/domain';
import { getActor } from '@/server/actor';
import {
  runProjectConceptExtraction,
  type ConceptGraphWorkspaceEvent,
} from '@/server/concept-extraction-runner';
import { createProjectDeps } from '@/server/project-deps';

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const actor = await getActor();

  if (!actor) {
    return new Response('Unauthorized.', { status: 401 });
  }

  const { projectId } = await context.params;
  const { searchParams } = new URL(request.url);
  const instruction = searchParams.get('instruction')?.trim() || null;
  const deps = createProjectDeps();
  const project = await deps.projectRepository.findByIdForOwner(projectId, actor.id);

  if (!project) {
    return new Response('Project not found.', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ConceptGraphWorkspaceEvent) => {
        controller.enqueue(
          encoder.encode(`event: graph_workspace\ndata: ${JSON.stringify(event)}\n\n`)
        );
      };

      try {
        send({
          text: 'I am opening a concept graph workspace run.',
          type: 'assistant_message',
        });

        const artifact = await deps.artifactRepository.findByProjectAndType(
          project.id,
          ARTIFACT_TYPE.CONCEPT_GRAPH
        );
        const shouldCreateRevision =
          instruction &&
          artifact?.currentVersionId &&
          artifact.status === ARTIFACT_STATUS.GENERATED;

        if (shouldCreateRevision) {
          await requestConceptRevision(
            {
              artifactId: artifact.id,
              revisionFeedback: instruction,
            },
            deps,
            actor
          );
        }

        const processingProject = await deps.projectRepository.updateStatus(
          project.id,
          PROJECT_STATUS.PROCESSING
        );

        if (!processingProject) {
          throw new Error('Project not found.');
        }

        await runProjectConceptExtraction(
          {
            instruction,
            onEvent: send,
            projectId: project.id,
            revisionFeedback: instruction,
          },
          deps
        );

        revalidatePath(`/dashboard/projects/${project.id}`);
      } catch (error) {
        send({
          text: error instanceof Error ? error.message : 'Concept graph build failed.',
          type: 'assistant_message',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
    },
  });
}
