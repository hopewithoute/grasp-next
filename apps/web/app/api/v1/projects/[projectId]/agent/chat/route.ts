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
};

type ActivityWriter = (event: AgentActivityEvent) => void;

const ACTIVITY_FLUSH_INTERVAL_MS = 100;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readToolName(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return typeof record.toolName === 'string' ? record.toolName : null;
}

function readToolCalls(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  return Array.isArray(record.toolCalls) ? record.toolCalls : [];
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function describeToolActivity(
  toolName: string,
  input: unknown,
  status: AgentActivityEvent['status']
): AgentActivityEvent {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const concept = readString(record, 'name') ?? readString(record, 'conceptKey');
  const source = readString(record, 'sourceConceptKey');
  const target = readString(record, 'targetConceptKey');

  switch (toolName) {
    case 'search-wiki-concepts':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Checking graph' : 'Checked graph',
        detail: status === 'started' ? 'Looking for matching concepts in this project.' : 'Found the closest existing concepts.',
        status,
      };
    case 'add-concept':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Adding concept' : 'Added concept',
        detail: concept ? `${status === 'started' ? 'Saving' : 'Saved'} ${concept}.` : `${status === 'started' ? 'Saving' : 'Saved'} a new concept.`,
        status,
      };
    case 'update-concept':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Updating concept' : 'Updated concept',
        detail: concept ? `${status === 'started' ? 'Refining' : 'Refined'} ${concept}.` : `${status === 'started' ? 'Refining' : 'Refined'} an existing concept.`,
        status,
      };
    case 'delete-concept':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Removing concept' : 'Removed concept',
        detail: concept ? `${status === 'started' ? 'Removing' : 'Removed'} ${concept}.` : `${status === 'started' ? 'Removing' : 'Removed'} a concept from the graph.`,
        status,
      };
    case 'add-relationship':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Linking concepts' : 'Linked concepts',
        detail: source && target ? `${status === 'started' ? 'Connecting' : 'Connected'} ${source} to ${target}.` : `${status === 'started' ? 'Adding' : 'Added'} a relationship between concepts.`,
        status,
      };
    case 'delete-relationship':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Removing link' : 'Removed link',
        detail: `${status === 'started' ? 'Removing' : 'Removed'} a relationship from the graph.`,
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
    case 'add-evidence':
      return {
        type: 'agent_activity',
        label: status === 'started' ? 'Attaching evidence' : 'Attached evidence',
        detail: concept ? `${status === 'started' ? 'Adding' : 'Added'} evidence to ${concept}.` : `${status === 'started' ? 'Adding' : 'Added'} evidence to a concept.`,
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

function withActivityEvents<T extends Record<string, unknown>>(tools: T, emit: ActivityWriter): T {
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
            emit(describeToolActivity(toolRecord.id ?? key, args[0], 'started'));
            const result = await toolRecord.execute(...args);
            emit(describeToolActivity(toolRecord.id ?? key, args[0], 'completed'));
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

  const { messages, selectedConcepts } = (await request.json()) as ChatRequestBody;

  if (selectedConcepts && Array.isArray(selectedConcepts) && selectedConcepts.length > 0 && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user') {
      const conceptsList = selectedConcepts.map((c) => `${c.name} (conceptKey: ${c.id})`).join(', ');
      lastMessage.content += `\n\n[System Note: The user has explicitly attached the following concepts to this message as context: ${conceptsList}. Reason over these concepts when responding.]`;
    }
  }

  try {
    const activityEvents: AgentActivityEvent[] = [];
    const tools = withActivityEvents(
      createRefinementTools({
        knowledgebaseRepository: deps.knowledgebaseRepository,
        projectId,
      }),
      (event) => activityEvents.push(event)
    );

    const result = await refinementAgent.stream(messages, {
      toolsets: { refinement: tools },
      maxSteps: 10,
      onFinish: async (event: unknown) => {
        let hasMutation = false;
        const mutationTools = [
          'add-concept', 'update-concept', 'delete-concept', 
          'add-relationship', 'delete-relationship', 'add-evidence'
        ];

        const eventRecord =
          event && typeof event === 'object' ? (event as Record<string, unknown>) : {};
        const steps = Array.isArray(eventRecord.steps) ? eventRecord.steps : [];
        const rootToolCalls = readToolCalls(event);

        if (steps.length > 0) {
          hasMutation = steps.some((step) =>
            readToolCalls(step).some((call) => {
              const toolName = readToolName(call);
              return toolName ? mutationTools.includes(toolName) : false;
            })
          );
        } else if (rootToolCalls.length > 0) {
          hasMutation = rootToolCalls.some((call) => {
            const toolName = readToolName(call);
            return toolName ? mutationTools.includes(toolName) : false;
          });
        }

        if (hasMutation) {
          console.log(`[Refinement Agent] Mutations detected in chat. Creating snapshot for project ${projectId}`);
          await deps.knowledgebaseRepository.createSnapshot({
            projectId,
            trigger: 'agent_refinement_chat'
          });
        }
      }
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
