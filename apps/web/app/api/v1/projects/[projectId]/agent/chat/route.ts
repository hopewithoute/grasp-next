import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { readMastraTextDelta } from '@/server/refinement-chat-stream';
import { refinementAgent, createRefinementTools, type GraphProposalPayload } from '@grasp/ai/refinement';
import { robustStream } from '@grasp/ai/mastra';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type SelectedConcept = {
  id: string;
  name: string;
};

type AgentActivityEvent = {
  type: 'agent_activity';
  label: string;
  detail: string;
  status: 'started' | 'completed';
};

type ChatRequestBody = {
  messages: ChatMessage[];
  selectedConcepts?: SelectedConcept[];
  threadId?: string;
};

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

  const { messages, selectedConcepts, threadId } = (await request.json()) as ChatRequestBody;

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
          onAddWebSource: async (url, title, text, skipIngestion) => {
            const source = await deps.projectSourceRepository.createForProjectOwner(projectId, actor.id, {
              title,
              content: text,
              type: 'markdown',
              fileRef: url,
            });
            if (!source) throw new Error('Failed to create source');

            if (!skipIngestion) {
              // Fire and forget the background ingestion
              import('@/server/source-ingestion-runner').then(({ runSourceIngestion }) => {
                runSourceIngestion({
                  projectId,
                  sourceId: source.id,
                  sourceTitle: source.title,
                  sourceType: 'markdown',
                  content: source.content ?? '',
                }, deps).catch(console.error);
              });
            }

            return source.id;
          }
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

          for await (const chunk of result.fullStream as AsyncIterable<any>) {
            // Check for native Mastra tool streaming chunks
            const customType = chunk?.type ?? chunk?.payload?.output?.type;
            const customData = chunk?.data ?? chunk?.payload?.output?.data ?? chunk?.payload?.output;

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
