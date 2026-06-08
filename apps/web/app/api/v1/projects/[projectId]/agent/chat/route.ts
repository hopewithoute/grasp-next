import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { robustStream } from '@grasp/ai/mastra';
import { createRefinementTools, refinementAgent } from '@grasp/ai/refinement';
import { safeParse, v } from '@grasp/domain';
import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { readMastraTextDelta } from '@/server/refinement-chat-stream';
import { parseJsonRequest, validationErrorResponse } from '../../../../http';

type MastraChunk = {
  type?: string;
  data?: unknown;
  payload?: {
    output?: {
      type?: string;
      data?: unknown;
    } | null;
  };
};

const chatMessageSchema = v.object({
  role: v.picklist(['user', 'assistant', 'system']),
  content: v.string(),
});

const selectedConceptSchema = v.object({
  id: v.string(),
  name: v.string(),
});

const chatRequestBodySchema = v.object({
  messages: v.array(chatMessageSchema),
  selectedConcepts: v.optional(v.array(selectedConceptSchema)),
  threadId: v.optional(v.string()),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const actor = await getActor();
  if (!actor) {
    return new Response('Unauthorized.', { status: 401 });
  }

  const { projectId } = await params;
  const deps = createProjectDeps();
  const project = await deps.projectRepository.findByIdForOwner(projectId, actor.id);

  if (!project) {
    return new Response('Project not found.', { status: 404 });
  }

  const bodyResult = await parseJsonRequest(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = safeParse(chatRequestBodySchema, bodyResult.value);
  if (!parsed.success) {
    const errorResponse = validationErrorResponse(parsed);
    if (errorResponse) return errorResponse;
    return new Response('Invalid request body.', { status: 400 });
  }

  const { messages, selectedConcepts, threadId } = parsed.output;

  if (
    selectedConcepts &&
    Array.isArray(selectedConcepts) &&
    selectedConcepts.length > 0 &&
    messages.length > 0
  ) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user') {
      const conceptsList = selectedConcepts
        .map((c) => `${c.name} (conceptKey: ${c.id})`)
        .join(', ');
      lastMessage.content += `\n\n[System Note: The user has explicitly attached the following concepts to this message as context: ${conceptsList}. Reason over these concepts when responding.]`;
    }
  }

  try {
    const stream = createUIMessageStream({
      async execute({ writer }) {
        const textId = 'assistant-response';
        let wroteText = false;
        let needsNewline = false;

        writer.write({ type: 'text-start', id: textId });

        const tools = createRefinementTools({
          knowledgebaseRepository: deps.knowledgebaseRepository,
          projectId,
        });

        try {
          const result = await robustStream(refinementAgent, messages, {
            memory: {
              resource: projectId,
              thread: threadId ?? `refinement:${projectId}:${actor.id}`,
            },
            toolsets: { refinement: tools },
            maxSteps: 10,
          });

          for await (const chunk of result.fullStream as AsyncIterable<unknown>) {
            const mastraChunk = chunk as MastraChunk;
            // Check for native Mastra tool streaming chunks
            const customType = mastraChunk.type ?? mastraChunk.payload?.output?.type;
            const customData =
              mastraChunk.data ?? mastraChunk.payload?.output?.data ?? mastraChunk.payload?.output;

            if (customType === 'data-agent-activity') {
              if (wroteText) needsNewline = true;
              writer.write({
                type: 'data-agent-activity',
                data: customData,
                transient: true,
              });
              continue;
            }

            if (customType === 'data-agent-proposal') {
              if (wroteText) needsNewline = true;
              writer.write({
                type: 'data-agent-proposal',
                data: customData,
              });
              continue;
            }

            if (customType === 'data-source-proposal') {
              if (wroteText) needsNewline = true;
              writer.write({
                type: 'data-source-proposal',
                data: customData,
              });
              continue;
            }

            const text =
              typeof chunk === 'string'
                ? chunk
                : readMastraTextDelta(chunk as Parameters<typeof readMastraTextDelta>[0]);

            if (text) {
              if (needsNewline) {
                writer.write({ type: 'text-delta', id: textId, delta: '\n\n' });
                needsNewline = false;
              }
              wroteText = true;
              writer.write({ type: 'text-delta', id: textId, delta: text });
            }
          }

          if (!wroteText) {
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: 'Selesai. Perubahan graph sudah diproses.',
            });
          }
        } catch (error) {
          console.error('Chat stream error:', error);
          writer.write({
            type: 'text-delta',
            id: textId,
            delta:
              'Maaf, proses agent terhenti sebelum selesai. Coba kirim ulang instruksi yang lebih spesifik.',
          });
        }

        writer.write({ type: 'text-end', id: textId });
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: {
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error: unknown) {
    console.error('Chat API Error:', error);
    return new Response(`Server error: ${error instanceof Error ? error.message : String(error)}`, {
      status: 500,
    });
  }
}
