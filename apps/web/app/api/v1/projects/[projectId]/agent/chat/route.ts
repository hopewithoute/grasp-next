import { getActor } from '@/server/actor';
import { createProjectDeps } from '@/server/project-deps';
import { readMastraTextDelta } from '@/server/refinement-chat-stream';
import { refinementAgent, createRefinementTools } from '@grasp/ai/refinement';
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

type ActivityWriter = (event: AgentActivityEvent) => void;

const ACTIVITY_FLUSH_INTERVAL_MS = 100;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeToolActivity(
  toolName: string,
  input: unknown,
  status: AgentActivityEvent['status']
): AgentActivityEvent {
  switch (toolName) {
    case 'search-wiki-concepts':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Checking graph' : 'Checked graph',
        detail: status === 'started' ? 'Looking for matching concepts in this project.' : 'Found the closest existing concepts.',
        status,
      };
    case 'search-web-ddg':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Checking web' : 'Checked web',
        detail: status === 'started' ? 'Looking up supporting information.' : 'Reviewed search results.',
        status,
      };
    case 'read-webpage':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Reading source' : 'Read source',
        detail: `${status === 'started' ? 'Reviewing' : 'Reviewed'} a web page for context.`,
        status,
      };
    case 'propose-graph-changes':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Preparing proposal' : 'Proposal ready',
        detail: status === 'started' ? 'Drafting graph changes for your review.' : 'Proposal submitted for approval.',
        status,
      };
    default:
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Working on graph' : 'Updated graph',
        detail: status === 'started' ? 'Updating the project context.' : 'Updated the project context.',
        status,
      };
  }
}

function withActivityEvents<T extends Record<string, unknown>>(tools: T, emitActivity: ActivityWriter, emitProposal: (p: any) => void): T {
  return Object.fromEntries(
    Object.entries(tools).map(([key, tool]) => {
      if (!tool || typeof tool !== 'object' || typeof (tool as { execute?: unknown }).execute !== 'function') {
        return [key, tool];
      }

      const toolRecord = tool as { id?: string; execute: (...args: unknown[]) => Promise<unknown> };
      return [
        key,
        {
          ...toolRecord,
          execute: async (...args: unknown[]) => {
            const toolId = toolRecord.id ?? key;
            if (toolId === 'propose-graph-changes' || key === 'proposeGraphChangesTool') {
              emitActivity(describeToolActivity(toolId, args[0], 'started'));
              emitProposal(args[0]);
              const result = await toolRecord.execute(...args);
              emitActivity(describeToolActivity(toolId, args[0], 'completed'));
              return result;
            }
            
            emitActivity(describeToolActivity(toolId, args[0], 'started'));
            const result = await toolRecord.execute(...args);
            emitActivity(describeToolActivity(toolId, args[0], 'completed'));
            return result;
          },
        },
      ];
    })
  ) as T;
}

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

  if (selectedConcepts && Array.isArray(selectedConcepts) && selectedConcepts.length > 0 && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user') {
      const conceptsList = selectedConcepts.map((c) => `${c.name} (conceptKey: ${c.id})`).join(', ');
      lastMessage.content += `\n\n[System Note: The user has explicitly attached the following concepts to this message as context: ${conceptsList}. Reason over these concepts when responding.]`;
    }
  }

  try {
    const activityEvents: AgentActivityEvent[] = [];
    const proposalEvents: any[] = [];
    
    const tools = withActivityEvents(
      createRefinementTools({
        knowledgebaseRepository: deps.knowledgebaseRepository,
        projectId,
      }),
      (event) => activityEvents.push(event),
      (proposal) => proposalEvents.push(proposal)
    );

    const agentMessages = messages;
    const result = await refinementAgent.stream(agentMessages, {
      memory: {
        resource: projectId,
        thread: threadId ?? `refinement:${projectId}:${actor.id}`,
      },
      toolsets: { refinement: tools },
      maxSteps: 10,
    });

    const stream = createUIMessageStream({
      async execute({ writer }) {
        const textId = 'assistant-response';
        let wroteText = false;
        let needsNewline = false;

        const flushActivityEvents = () => {
          let hasActivity = false;
          while (activityEvents.length > 0) {
            hasActivity = true;
            writer.write({
              type: 'data-agent-activity',
              data: activityEvents.shift()!,
              transient: true,
            });
          }
          while (proposalEvents.length > 0) {
            hasActivity = true;
            writer.write({
              type: 'data-agent-proposal',
              data: proposalEvents.shift()!,
            });
          }
          if (hasActivity && wroteText) {
            needsNewline = true;
          }
        };

        writer.write({ type: 'text-start', id: textId });

        try {
          const streamReader = (result.fullStream as ReadableStream<unknown>).getReader();
          let pendingText = streamReader.read();

          while (true) {
            const next = await Promise.race([
              pendingText,
              wait(ACTIVITY_FLUSH_INTERVAL_MS).then(() => null),
            ]);

            flushActivityEvents();

            if (next === null) {
              continue;
            }

            if (next.done) {
              break;
            }

            const chunk = next.value;
            const text = typeof chunk === 'string' ? chunk : readMastraTextDelta(chunk as Parameters<typeof readMastraTextDelta>[0]);

            if (text) {
              if (needsNewline) {
                writer.write({ type: 'text-delta', id: textId, delta: '\n\n' });
                needsNewline = false;
              }
              wroteText = true;
              writer.write({ type: 'text-delta', id: textId, delta: text });
            }

            pendingText = streamReader.read();
          }

          flushActivityEvents();

          if (!wroteText) {
            writer.write({
              type: 'text-delta',
              id: textId,
              delta: 'Selesai. Perubahan graph sudah diproses.',
            });
          }
        } catch (error) {
          console.error('Chat stream error:', error);
          flushActivityEvents();
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
    return new Response(`Server error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
  }
}
