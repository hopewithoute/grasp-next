'use client';

import { type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useChatThread } from '../hooks/use-chat-thread';
import { usePendingProposals } from '../hooks/use-pending-proposals-context';
import { type ConceptRow } from '../types';
import { ChatItemRow } from './chat-message';
import { CollapsedPaneRail, PaneHeader } from './shared-components';

export function ChatPane({
  collapsed,
  items,
  onCollapseToggle,
  onIngestionTrigger,
  projectId,
  chatContextConcepts,
  onRemoveChatContext,
  onHoverChatContext,
}: {
  collapsed: boolean;
  items: import('../types').ChatItem[];
  onCollapseToggle: () => void;
  onIngestionTrigger: (sourceId: string, title: string, type: string, content: string) => void;
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
    handleApproveSourceProposal,
    handleRejectSourceProposal,
    isLoading,
    scrollRef,
  } = useChatThread(projectId, chatContextConcepts, onIngestionTrigger);

  // Derive pending proposals (syncs to parent state via useDerivedPendingProposals)
  usePendingProposals();

  if (collapsed) {
    return (
      <CollapsedPaneRail
        ariaLabel="Expand refinement"
        meta={`${items.length} EVENTS`}
        onToggle={onCollapseToggle}
        side="right"
        title="[ REFINEMENT ]"
      />
    );
  }

  const hasPendingProposal = messages.some(
    (m) => (m.kind === 'proposal' || m.kind === 'source_proposal') && m.status === 'pending'
  );

  return (
    <aside
      aria-label="Refinement chat"
      className="border-border/40 bg-background/50 flex min-h-[520px] w-full flex-col border-l border-dashed lg:min-h-0"
    >
      <PaneHeader
        meta={
          <span className="text-muted-foreground font-mono text-[0.62rem] tracking-[0.2em] uppercase">
            {items.length} EVENTS
          </span>
        }
        onCollapseToggle={onCollapseToggle}
        side="right"
        title="[ REFINEMENT ]"
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4" ref={scrollRef}>
        <ol className="space-y-3">
          {[...items, ...messages].map((item) => (
            <ChatItemRow
              isLoading={isLoading}
              item={item}
              key={item.id}
              onApproveProposal={handleApproveProposal}
              onRejectProposal={handleRejectProposal}
              onApproveSourceProposal={handleApproveSourceProposal}
              onRejectSourceProposal={handleRejectSourceProposal}
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
    <div className="border-border bg-card flex shrink-0 flex-col gap-2 border-t px-4 py-3">
      {chatContextConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chatContextConcepts.map((concept) => (
            <span
              key={concept.id}
              onMouseEnter={() => onHoverChatContext?.(concept.id)}
              onMouseLeave={() => onHoverChatContext?.(null)}
              className="border-brand-accent/50 bg-brand-accent/10 text-brand-accent hover:border-brand-accent inline-flex cursor-default items-center gap-2 rounded-none border py-1 pr-1.5 pl-2 font-mono text-[0.65rem] tracking-widest uppercase transition-all"
            >
              {concept.name}
              <button
                aria-label="Button"
                type="button"
                onClick={() => onRemoveChatContext(concept.id)}
                className="hover:bg-brand-accent hover:text-background text-brand-accent p-0.5 transition-colors"
              >
                <X className="size-3" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          name="chatInput"
          aria-label="Input field"
          className="border-border/40 text-foreground placeholder:text-muted-foreground/30 focus:border-brand-accent focus:bg-brand-accent/5 bg-background flex-1 rounded-none border px-3 py-2 font-mono text-xs transition-colors outline-none disabled:opacity-50"
          placeholder={
            hasPendingProposal ? '[ RESOLVE PENDING PROPOSAL ]' : '[ INSTRUCT AGENT... ]'
          }
          disabled={isLoading || hasPendingProposal}
        />
        <button
          aria-label="Button"
          type="submit"
          disabled={isLoading || hasPendingProposal}
          className="border-brand-accent/50 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent hover:text-background disabled:hover:bg-brand-accent/10 disabled:hover:text-brand-accent rounded-none border px-4 py-2 font-mono text-[0.65rem] tracking-widest uppercase transition-all disabled:opacity-50"
        >
          [ SEND ]
        </button>
      </form>
    </div>
  );
}
