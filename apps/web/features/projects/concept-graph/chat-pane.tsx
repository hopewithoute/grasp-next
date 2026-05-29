import {
  memo,
  useCallback,
  useState,
  useRef,
  useEffect,
  type ComponentProps,
  type FormEvent,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  CheckCircle2,
  CircleDashed,
  FileText,
  GitBranch,
  Info,
  MessageSquareText,
  Quote,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { consumeUIMessageChunks } from '@/lib/ui-message-stream';
import { type ConceptRow } from './types';
import { type ChatItem, type StreamEvent } from './types';
import { CollapsedPaneRail, PaneHeader } from './shared-components';
import { ProposalCard, type ProposalPayload } from './proposal-card';
import { executeGraphProposalAction } from '../actions';
import { useClientHydrated } from './use-concept-graph-state';

export function ChatPane({
  collapsed,
  items,
  onCollapseToggle,
  projectId,
  chatContextConcepts,
  onRemoveChatContext,
  onHoverChatContext,
  onPendingProposalsChange,
}: {
  collapsed: boolean;
  items: ChatItem[];
  onCollapseToggle: () => void;
  projectId: string;
  chatContextConcepts: ConceptRow[];
  onRemoveChatContext: (id: string) => void;
  onHoverChatContext?: (id: string | null) => void;
  onPendingProposalsChange?: (proposals: ProposalPayload[]) => void;
}) {
  const { refresh } = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedStoredMessagesRef = useRef(false);
  const threadIdRef = useRef<string | null>(null);
  if (threadIdRef.current === null) {
    threadIdRef.current = `refinement-${projectId}-${crypto.randomUUID()}`;
  }
  const isClientHydrated = useClientHydrated();

  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isClientHydrated) return;

    const timeoutId = window.setTimeout(() => {
      setMessages(readStoredChatMessages(projectId));
      hasLoadedStoredMessagesRef.current = true;
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isClientHydrated, projectId]);

  // Save to session storage when messages change
  useEffect(() => {
    if (!hasLoadedStoredMessagesRef.current) return;
    window.sessionStorage.setItem(`grasp-chat-${projectId}`, JSON.stringify(messages));
  }, [messages, projectId]);

  // Extract pending proposals and lift them up
  useEffect(() => {
    if (onPendingProposalsChange) {
      const allProposals = [...items, ...messages]
        .filter(
          (item): item is Extract<ChatItem, { kind: 'proposal' }> =>
            item.kind === 'proposal' && item.status === 'pending'
        )
        .map((item) => item.proposal);
      onPendingProposalsChange(allProposals);
    }
  }, [items, messages, onPendingProposalsChange]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput('');
    setIsLoading(true);

    const userMsgId = `user-${Date.now()}`;
    const agentMsgId = `agent-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, kind: 'message', role: 'user', text: userText, streaming: false },
      { id: agentMsgId, kind: 'message', role: 'agent', text: '', streaming: true },
    ]);

    try {
      const payloadMessages = [
        ...messages.reduce(
          (acc, m) => {
            if (m.kind === 'message')
              acc.push({ role: m.role === 'agent' ? 'assistant' : m.role, content: m.text });
            return acc;
          },
          [] as Array<{ role: string; content: string }>
        ),
        { role: 'user', content: userText },
      ];

      const response = await fetch(`/api/v1/projects/${projectId}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          selectedConcepts: chatContextConcepts.map((concept) => ({
            id: concept.id,
            name: concept.name,
          })),
          threadId: threadIdRef.current,
        }),
      });

      if (!response.ok) {
        throw new Error('Agent request failed');
      }

      if (!response.body) throw new Error('No stream body returned');

      let displayText = '';
      let hasAgentMessage = true;

      await consumeUIMessageChunks(response.body, (chunk) => {
        if (chunk.type === 'data-agent-activity') {
          const event = chunk.data as StreamEvent;
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.kind === 'event' && lastMsg.event.type === 'agent_activity') {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = { ...lastMsg, event };
              return newMessages;
            }
            return [...prev, { id: `activity-${Date.now()}-${prev.length}`, kind: 'event', event }];
          });
          return;
        }

        if (chunk.type === 'data-agent-proposal') {
          const proposal = chunk.data as ProposalPayload;
          setMessages((prev) => [
            ...prev,
            { id: `proposal-${Date.now()}`, kind: 'proposal', proposal, status: 'pending' },
          ]);
          return;
        }

        if (chunk.type === 'text-start') {
          setMessages((prev) => {
            if (hasAgentMessage) {
              return prev;
            }

            hasAgentMessage = true;
            return [
              ...prev,
              { id: agentMsgId, kind: 'message', role: 'agent', text: '', streaming: true },
            ];
          });
          return;
        }

        if (chunk.type === 'text-delta') {
          displayText += chunk.delta;
          setMessages((prev) => {
            if (!hasAgentMessage) {
              hasAgentMessage = true;
              return [
                ...prev,
                {
                  id: agentMsgId,
                  kind: 'message',
                  role: 'agent',
                  text: displayText,
                  streaming: true,
                },
              ];
            }

            return prev.map((m: ChatItem) =>
              m.id === agentMsgId && m.kind === 'message' ? { ...m, text: displayText } : m
            );
          });
          return;
        }

        if (chunk.type === 'text-end' || chunk.type === 'finish') {
          const finalText = displayText.trim()
            ? displayText
            : 'Done. The agent did not send a summary, but the event stream has finished.';

          setMessages((prev) => {
            const filtered = prev.filter(
              (m: ChatItem) => !(m.kind === 'event' && m.event.type === 'agent_activity')
            );

            if (!hasAgentMessage) {
              hasAgentMessage = true;
              return [
                ...filtered,
                {
                  id: agentMsgId,
                  kind: 'message',
                  role: 'agent',
                  text: finalText,
                  streaming: false,
                },
              ];
            }

            return filtered.map((m) =>
              m.id === agentMsgId ? { ...m, text: finalText, streaming: false } : m
            );
          });
        }
      });
    } catch (err) {
      console.error('Chat failed:', err);
      setMessages((prev) => {
        const filtered = prev.filter(
          (m: ChatItem) => !(m.kind === 'event' && m.event.type === 'agent_activity')
        );
        const fallbackText =
          'Sorry, the agent stopped before finishing. Please try again with more specific instructions.';
        if (!filtered.some((m) => m.id === agentMsgId)) {
          return [
            ...filtered,
            {
              id: agentMsgId,
              kind: 'message',
              role: 'agent',
              text: fallbackText,
              streaming: false,
            },
          ];
        }

        return filtered.map((m) => (m.id === agentMsgId ? { ...m, text: fallbackText } : m));
      });
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((m: ChatItem) =>
          m.id === agentMsgId && m.kind === 'message' ? { ...m, streaming: false } : m
        )
      );
      refresh();
    }
  };

  const handleApproveProposal = useCallback(
    async (id: string, proposal: ProposalPayload) => {
      setIsLoading(true);
      try {
        const result = await executeGraphProposalAction(projectId, proposal.actions);
        const sysUserMsg = {
          id: `sys-${Date.now()}`,
          kind: 'message' as const,
          role: 'user' as const,
          text: '[System: User approved and applied the proposal]',
          streaming: false,
        };
        setMessages((prev) => [
          ...prev.map((m) => (m.id === id ? { ...m, status: 'approved' as const } : m)),
          sysUserMsg,
          {
            id: `sys-reply-${Date.now()}`,
            kind: 'message',
            role: 'agent',
            text: `Proposal successfully applied to the graph! (${result.applied} actions)`,
            streaming: false,
          },
        ]);
        refresh();
      } catch (e) {
        console.error(e);
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: 'pending' as const } : m))
        );
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, refresh]
  );

  const handleRejectProposal = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'rejected' as const } : m))
    );
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        kind: 'message',
        role: 'user',
        text: 'I reject this proposal. Please reconsider and provide a different solution or ask clarifying questions.',
        streaming: false,
      },
    ]);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    queueMicrotask(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [items, messages]);

  if (collapsed) {
    return (
      <CollapsedPaneRail
        ariaLabel="Expand refinement"
        eyebrow="Refinement"
        meta="active"
        onToggle={onCollapseToggle}
        side="right"
        title="Graph agent"
      />
    );
  }

  const hasPendingProposal = messages.some((m) => m.kind === 'proposal' && m.status === 'pending');

  return (
    <aside
      aria-label="Refinement chat"
      className="flex min-h-[520px] w-full flex-col border-l border-border bg-card lg:min-h-0"
    >
      <PaneHeader
        eyebrow="Refinement"
        meta={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent-border/30 bg-brand-accent-surface px-2 py-0.5 font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-brand-accent-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-brand-accent" />
            active
          </span>
        }
        onCollapseToggle={onCollapseToggle}
        side="right"
        title="Graph agent"
      />

      <div className="border-b border-border px-4 py-3">
        <p className="text-[0.78rem] leading-5 text-muted-foreground">
          Chat with the agent to modify concepts and relationships directly. Hold{' '}
          <kbd className="font-mono text-[0.65rem] border border-border bg-white/5 rounded px-1">
            Ctrl/Cmd
          </kbd>{' '}
          and click concepts to attach them as context.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4" ref={scrollRef}>
        <ol className="space-y-3">
          {items.map((item) => (
            <ChatItemRow
              isLoading={isLoading}
              item={item}
              key={item.id}
              onApproveProposal={handleApproveProposal}
              onRejectProposal={handleRejectProposal}
            />
          ))}
          {messages.map((item) => (
            <ChatItemRow
              isLoading={isLoading}
              item={item}
              key={item.id}
              onApproveProposal={handleApproveProposal}
              onRejectProposal={handleRejectProposal}
            />
          ))}
        </ol>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex flex-col gap-2">
        {chatContextConcepts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chatContextConcepts.map((concept) => (
              <span
                key={concept.id}
                onMouseEnter={() => onHoverChatContext?.(concept.id)}
                onMouseLeave={() => onHoverChatContext?.(null)}
                className="inline-flex items-center gap-1 rounded-full border border-brand-accent-border/30 bg-brand-accent-surface pl-2 pr-1 py-0.5 text-xs text-brand-accent-foreground cursor-default transition-all hover:ring-2 hover:ring-brand-accent/50"
              >
                {concept.name}
                <button
                  aria-label="Button"
                  type="button"
                  onClick={() => onRemoveChatContext(concept.id)}
                  className="rounded-full p-0.5 hover:bg-brand-accent/20 text-brand-accent-foreground/70 hover:text-brand-accent-foreground transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 3L3 9M3 3L9 9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            aria-label="Input field"
            className="flex-1 rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:border-brand-accent-border focus:outline-none focus:ring-1 focus:ring-[#53d1cb]/50 disabled:opacity-50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              hasPendingProposal
                ? 'Please approve or reject the pending proposal first.'
                : 'Instruct the agent...'
            }
            disabled={isLoading || hasPendingProposal}
          />
          <button
            aria-label="Button"
            type="submit"
            disabled={isLoading || hasPendingProposal || !input.trim()}
            className="rounded-md bg-brand-accent/20 px-3 py-2 text-sm font-medium text-brand-accent-foreground hover:bg-brand-accent/30 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </aside>
  );
}

function readStoredChatMessages(projectId: string): ChatItem[] {
  if (typeof window === 'undefined') return [];

  const saved = window.sessionStorage.getItem(`grasp-chat-${projectId}`);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as ChatItem[]) : [];
  } catch (error) {
    console.error('Failed to parse chat history', error);
    return [];
  }
}

const ChatItemRow = memo(function ChatItemRow({
  isLoading,
  item,
  onApproveProposal,
  onRejectProposal,
}: {
  isLoading: boolean;
  item: ChatItem;
  onApproveProposal: (id: string, proposal: ProposalPayload) => void;
  onRejectProposal: (id: string) => void;
}) {
  if (item.kind === 'message') {
    return (
      <li>
        <ChatMessage role={item.role} streaming={item.streaming || false} text={item.text} />
      </li>
    );
  }

  if (item.kind === 'proposal') {
    return (
      <li>
        <ProposalCard
          proposal={item.proposal}
          status={item.status}
          isProcessing={item.status !== 'pending' || isLoading}
          onApprove={() => onApproveProposal(item.id, item.proposal)}
          onReject={() => onRejectProposal(item.id)}
        />
      </li>
    );
  }

  return (
    <li>
      <ChatEvent event={item.event} />
    </li>
  );
});

const ChatMessage = memo(function ChatMessage({
  role,
  streaming,
  text,
}: {
  role: 'agent' | 'user';
  streaming: boolean;
  text: string;
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[28ch] rounded-2xl rounded-br-md border border-brand-accent-border bg-brand-accent/[0.08] px-3.5 py-2 text-sm leading-6 text-foreground sm:max-w-[36ch]">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-card text-brand-accent-foreground"
      >
        <Bot className="size-3.5" strokeWidth={1.5} />
      </span>
      <div className="max-w-[34ch] rounded-2xl rounded-tl-md border border-border bg-card/50 px-3.5 py-2 text-sm leading-6 text-muted-foreground">
        <MarkdownText text={text} />
        {streaming ? (
          <span
            aria-hidden
            className="ml-1 inline-block h-3.5 w-[2px] translate-y-0.5 bg-brand-accent stream-cursor"
          />
        ) : null}
      </div>
    </div>
  );
});

const MARKDOWN_REMARK_PLUGINS = [remarkGfm];

/* eslint-disable @typescript-eslint/no-unused-vars */
const MARKDOWN_COMPONENTS = {
  p: ({ node: _node, ...props }) => (
    <p className="whitespace-pre-wrap text-muted-foreground" {...props} />
  ),
  a: ({ node: _node, ...props }) => (
    <a
      className="text-[#9de7e2] underline decoration-[#53d1cb]/40 underline-offset-4 transition-colors hover:text-[#c8fffb]"
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {props.children || 'link'}
    </a>
  ),
  strong: ({ node: _node, ...props }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul className="list-disc space-y-1 pl-4 text-muted-foreground" {...props} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol className="list-decimal space-y-1 pl-4 text-muted-foreground" {...props} />
  ),
  li: ({ node: _node, ...props }) => <li {...props} />,
  pre: ({ node: _node, ...props }) => (
    <pre
      className="overflow-x-auto rounded-lg border border-border bg-[#050b12] p-3 font-mono text-[0.72rem] leading-5 text-[#d9f7f4] [&>code]:bg-transparent [&>code]:border-0 [&>code]:p-0 [&>code]:text-inherit"
      {...props}
    />
  ),
  code: ({ node: _node, ...props }: HTMLAttributes<HTMLElement> & { node?: unknown }) => (
    <code
      className="rounded border border-border bg-muted/50 px-1 py-0.5 font-mono text-[0.78em] text-[#9de7e2]"
      {...props}
    />
  ),
  h1: ({ node: _node, ...props }) => (
    <h1 className="mt-4 mb-2 text-lg font-semibold text-foreground" {...props}>
      {props.children}
    </h1>
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 className="mt-4 mb-2 text-base font-semibold text-foreground" {...props}>
      {props.children}
    </h2>
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 className="mt-3 mb-1.5 text-sm font-semibold text-foreground" {...props}>
      {props.children}
    </h3>
  ),
  table: ({ node: _node, ...props }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm text-muted-foreground" {...props} />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th
      className="border-b border-border bg-card/50 px-3 py-2 font-medium text-foreground"
      {...props}
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td className="border-b border-border px-3 py-2 last:border-b-0" {...props} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      className="border-l-2 border-brand-accent-border pl-3 italic text-muted-foreground"
      {...props}
    />
  ),
} satisfies ComponentProps<typeof ReactMarkdown>['components'];
/* eslint-enable @typescript-eslint/no-unused-vars */

const MarkdownText = memo(function MarkdownText({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div className="space-y-2.5 break-words">
      <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

const ChatEvent = memo(function ChatEvent({ event }: { event: StreamEvent }) {
  const tone = getEventTone(event);
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border bg-white/[0.02] px-3 py-2 text-xs leading-5',
        tone.border
      )}
    >
      <span
        className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-md', tone.iconBg)}
      >
        {tone.icon}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p
          className={cn(
            'font-mono text-[0.6rem] tabular-nums tracking-[0.18em] uppercase',
            tone.label
          )}
        >
          {tone.title}
        </p>
        <p className="text-[0.78rem] leading-5 text-muted-foreground">{tone.copy}</p>
      </div>
    </div>
  );
});

function getEventTone(event: StreamEvent): {
  border: string;
  copy: string;
  icon: ReactNode;
  iconBg: string;
  label: string;
  title: string;
} {
  switch (event.type) {
    case 'source_read':
      return {
        border: 'border-border',
        copy: event.title ? event.title : `Source · ${event.sourceId}`,
        icon: <FileText className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-card/50 text-muted-foreground',
        label: 'text-muted-foreground',
        title: 'Source read',
      };
    case 'concept_proposed':
      return {
        border: 'border-brand-accent-border',
        copy: event.definition ? `${event.name} — ${truncate(event.definition, 90)}` : event.name,
        icon: <Sparkles className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-brand-accent/[0.12] text-brand-accent',
        label: 'text-brand-accent-foreground',
        title: 'Concept proposed',
      };
    case 'relationship_proposed':
      return {
        border: 'border-brand-accent-border/18',
        copy: `${event.source} → ${event.target}`,
        icon: <GitBranch className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-brand-accent/[0.08] text-brand-accent',
        label: 'text-brand-accent-foreground',
        title: 'Prerequisite link',
      };
    case 'evidence_attached':
      return {
        border: 'border-border',
        copy: `${event.concept}${event.location ? ` · §${event.location}` : ''} — ${truncate(event.excerpt, 80)}`,
        icon: <Quote className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-card/50 text-muted-foreground',
        label: 'text-muted-foreground',
        title: 'Evidence attached',
      };
    case 'ingestion_complete':
      return {
        border: 'border-emerald-400/24',
        copy: `${event.conceptCount} concepts and ${event.relationshipCount} relationships ingested.`,
        icon: <CheckCircle2 className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-emerald-400/[0.14] text-emerald-300',
        label: 'text-emerald-300',
        title: 'Ingestion complete',
      };
    case 'agent_activity':
      return {
        border: event.status === 'started' ? 'border-brand-accent-border/18' : 'border-border',
        copy: event.detail,
        icon:
          event.status === 'started' ? (
            <CircleDashed className="size-3" strokeWidth={1.6} />
          ) : (
            <Info className="size-3" strokeWidth={1.6} />
          ),
        iconBg:
          event.status === 'started'
            ? 'bg-brand-accent/[0.08] text-brand-accent'
            : 'bg-card/50 text-muted-foreground',
        label:
          event.status === 'started' ? 'text-brand-accent-foreground' : 'text-muted-foreground',
        title: event.label,
      };
    default:
      return {
        border: 'border-border',
        copy: 'Activity',
        icon: <MessageSquareText className="size-3" strokeWidth={1.6} />,
        iconBg: 'bg-card/50 text-muted-foreground',
        label: 'text-muted-foreground',
        title: 'Event',
      };
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
