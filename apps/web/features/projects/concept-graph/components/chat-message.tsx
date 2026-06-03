'use client';

import { memo } from 'react';
import { Bot } from 'lucide-react';
import { type ChatItem } from '../types';
import { type ProposalPayload, type SourceProposalPayload } from '../types';
import { ProposalCard } from './proposal-card';
import { SourceProposalCard } from './source-proposal-card';
import { MarkdownText } from './chat-markdown';
import { ChatEvent } from './chat-event';

// --- ChatItemRow ---

export const ChatItemRow = memo(function ChatItemRow({
  isLoading,
  item,
  onApproveProposal,
  onRejectProposal,
  onApproveSourceProposal,
  onRejectSourceProposal,
}: {
  isLoading: boolean;
  item: ChatItem;
  onApproveProposal: (id: string, proposal: ProposalPayload) => void;
  onRejectProposal: (id: string) => void;
  onApproveSourceProposal?: (id: string, proposal: SourceProposalPayload) => void;
  onRejectSourceProposal?: (id: string) => void;
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

  if (item.kind === 'source_proposal') {
    return (
      <li>
        <SourceProposalCard
          proposal={item.proposal}
          status={item.status}
          isProcessing={item.status !== 'pending' || isLoading}
          onApprove={() => onApproveSourceProposal?.(item.id, item.proposal)}
          onReject={() => onRejectSourceProposal?.(item.id)}
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

// --- ChatMessage ---

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
