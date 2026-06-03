'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { consumeUIMessageChunks } from '@/lib/ui-message-stream';
import { type ConceptRow, type ChatItem, type StreamEvent } from '../types';
import { type ProposalPayload, type SourceProposalPayload } from '../types';
import { executeGraphProposalAction, addProjectSourceFromUrlFormAction } from '../../actions';
import { readStoredChatMessages, writeStoredChatMessages } from '../chat-storage';
import { useClientHydrated } from './use-concept-graph-state';

export type UseChatThreadResult = {
  messages: ChatItem[];
  setMessages: React.Dispatch<React.SetStateAction<ChatItem[]>>;
  handleSubmit: (input: string) => Promise<void>;
  handleApproveProposal: (id: string, proposal: ProposalPayload) => Promise<void>;
  handleRejectProposal: (id: string) => void;
  handleApproveSourceProposal: (id: string, proposal: SourceProposalPayload) => Promise<void>;
  handleRejectSourceProposal: (id: string) => void;
  isLoading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
};

export function useChatThread(
  projectId: string,
  chatContextConcepts: ConceptRow[]
): UseChatThreadResult {
  const { refresh } = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedStoredMessagesRef = useRef(false);
  const threadIdRef = useRef<string | null>(null);
  if (threadIdRef.current === null) {
    threadIdRef.current = `refinement-${projectId}-${crypto.randomUUID()}`;
  }
  const isClientHydrated = useClientHydrated();

  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Restore from session storage on mount
  useEffect(() => {
    if (!isClientHydrated) return;

    const timeoutId = window.setTimeout(() => {
      setMessages(readStoredChatMessages(projectId));
      hasLoadedStoredMessagesRef.current = true;
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isClientHydrated, projectId]);

  // Persist to session storage when messages change
  useEffect(() => {
    if (!hasLoadedStoredMessagesRef.current) return;
    writeStoredChatMessages(projectId, messages);
  }, [messages, projectId]);

  // Scroll to bottom on new items
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    queueMicrotask(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [messages]);

  const handleSubmit = useCallback(
    async (input: string) => {
      if (!input.trim() || isLoading) return;

      const userText = input;
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

          if (chunk.type === 'data-source-proposal') {
            const proposal = chunk.data as SourceProposalPayload;
            setMessages((prev) => [
              ...prev,
              { id: `source-proposal-${Date.now()}`, kind: 'source_proposal', proposal, status: 'pending' },
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
    },
    [projectId, chatContextConcepts, messages, isLoading, refresh]
  );

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

  const handleApproveSourceProposal = useCallback(
    async (id: string, proposal: SourceProposalPayload) => {
      setIsLoading(true);
      try {
        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('url', proposal.url);
        formData.append('title', proposal.title);

        const result = await addProjectSourceFromUrlFormAction({ error: null, success: false }, formData);

        if (!result.success) {
          setMessages((prev) => [
            ...prev.map((m) => (m.id === id ? { ...m, status: 'pending' as const } : m)),
            {
              id: `sys-error-${Date.now()}`,
              kind: 'message',
              role: 'agent',
              text: `Gagal menambahkan web source: ${result.error || 'Terjadi kesalahan jaringan.'}`,
              streaming: false,
            },
          ]);
          return;
        }

        const sysUserMsg = {
          id: `sys-${Date.now()}`,
          kind: 'message' as const,
          role: 'user' as const,
          text: `[System: User approved adding the web source. URL: ${proposal.url}]`,
          streaming: false,
        };
        setMessages((prev) => [
          ...prev.map((m) => (m.id === id ? { ...m, status: 'approved' as const } : m)),
          sysUserMsg,
          {
            id: `sys-reply-${Date.now()}`,
            kind: 'message',
            role: 'agent',
            text: `Web source has been successfully saved to the library and is queued for background ingestion. I can now propose graph changes if needed.`,
            streaming: false,
          },
        ]);
        refresh();
      } catch (e) {
        console.error(e);
        setMessages((prev) => [
          ...prev.map((m) => (m.id === id ? { ...m, status: 'pending' as const } : m)),
          {
            id: `sys-error-${Date.now()}`,
            kind: 'message',
            role: 'agent',
            text: `Gagal memproses persetujuan: ${e instanceof Error ? e.message : 'Unknown error'}`,
            streaming: false,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, refresh]
  );

  const handleRejectSourceProposal = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'rejected' as const } : m))
    );
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        kind: 'message',
        role: 'user',
        text: 'I reject adding this web source. Please do not add it.',
        streaming: false,
      },
    ]);
  }, []);

  return {
    messages,
    setMessages,
    handleSubmit,
    handleApproveProposal,
    handleRejectProposal,
    handleApproveSourceProposal,
    handleRejectSourceProposal,
    isLoading,
    scrollRef,
  };
}
