'use client';

import { type FormEvent, useMemo } from 'react';
import { type ConceptRow } from '../types';
import { usePendingProposals, useDerivedPendingProposals } from '../hooks/use-pending-proposals-context';
import { CollapsedPaneRail, PaneHeader } from './shared-components';
import { ChatItemRow } from './chat-message';
import { useChatThread } from '../hooks/use-chat-thread';

const ACTIVE_BADGE = (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-accent-border/30 bg-brand-accent-surface px-2 py-0.5 font-mono text-[0.62rem] tabular-nums tracking-[0.18em] uppercase text-brand-accent-foreground">
    <span aria-hidden className="size-1.5 rounded-full bg-brand-accent" />
    active
  </span>
);

export function ChatPane({
  collapsed,
  items,
  onCollapseToggle,
  projectId,
  chatContextConcepts,
  onRemoveChatContext,
  onHoverChatContext,
}: {
  collapsed: boolean;
  items: import('../types').ChatItem[];
  onCollapseToggle: () => void;
  projectId: string;
  chatContextConcepts: ConceptRow[];
  onRemoveChatContext: (id: string) => void;
  onHoverChatContext?: (id: string | null) => void;
}) {
  const {
    messages,
    handleSubmit,
    handleApproveProposal,
    handleRejectProposal,
    isLoading,
    scrollRef,
  } = useChatThread(projectId, chatContextConcepts);

  // Derive pending proposals (syncs to parent state via useDerivedPendingProposals)
  const { pendingProposals } = usePendingProposals();

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

  const hasPendingProposal = messages.some(
    (m) => m.kind === 'proposal' && m.status === 'pending'
  );

  return (
    <aside
      aria-label="Refinement chat"
      className="flex min-h-[520px] w-full flex-col border-l border-border bg-card lg:min-h-0"
    >
      <PaneHeader
        eyebrow="Refinement"
        meta={ACTIVE_BADGE}
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

      <ChatInput
        onSubmit={handleSubmit}
        isLoading={isLoading}
        hasPendingProposal={hasPendingProposal}
        chatContextConcepts={chatContextConcepts}
        onRemoveChatContext={onRemoveChatContext}
        onHoverChatContext={onHoverChatContext}
      />
    </aside>
  );
}

function ChatInput({
  onSubmit,
  isLoading,
  hasPendingProposal,
  chatContextConcepts,
  onRemoveChatContext,
  onHoverChatContext,
}: {
  onSubmit: (input: string) => Promise<void>;
  isLoading: boolean;
  hasPendingProposal: boolean;
  chatContextConcepts: ConceptRow[];
  onRemoveChatContext: (id: string) => void;
  onHoverChatContext?: (id: string | null) => void;
}) {
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('chatInput') as HTMLInputElement;
    await onSubmit(input.value);
    input.value = '';
  };

  return (
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
          name="chatInput"
          aria-label="Input field"
          className="flex-1 rounded-md border border-border bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:border-brand-accent-border focus:outline-none focus:ring-1 focus:ring-[#53d1cb]/50 disabled:opacity-50"
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
          disabled={isLoading || hasPendingProposal}
          className="rounded-md bg-brand-accent/20 px-3 py-2 text-sm font-medium text-brand-accent-foreground hover:bg-brand-accent/30 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
