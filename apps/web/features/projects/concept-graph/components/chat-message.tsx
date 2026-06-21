'use client';

import { memo } from 'react';
import {
  type ChatItem,
  type CurationProposalPayload,
  type ProposalPayload,
  type SourceProposalPayload,
} from '../types';
import { ChatEvent } from './chat-event';
import { MarkdownText } from './chat-markdown';
import { CurationProposalCard } from './curation-proposal-card';
import { ProposalCard } from './proposal-card';
import { SourceProposalCard } from './source-proposal-card';

// --- ChatItemRow ---

export const ChatItemRow = memo(function ChatItemRow({
  isLoading,
  item,
  onApproveProposal,
  onRejectProposal,
  onApproveSourceProposal,
  onRejectSourceProposal,
  onApproveCurationProposal,
  onRejectCurationProposal,
}: {
  isLoading: boolean;
  item: ChatItem;
  onApproveProposal: (id: string, proposal: ProposalPayload) => void;
  onRejectProposal: (id: string) => void;
  onApproveSourceProposal?: (id: string, proposal: SourceProposalPayload) => void;
  onRejectSourceProposal?: (id: string) => void;
  onApproveCurationProposal?: (id: string, proposal: CurationProposalPayload) => void;
  onRejectCurationProposal?: (id: string) => void;
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
          isProcessing={item.status !== 'pending' || isLoading}
          onApprove={() => onApproveSourceProposal?.(item.id, item.proposal)}
          onReject={() => onRejectSourceProposal?.(item.id)}
          proposal={item.proposal}
          status={item.status}
        />
      </li>
    );
  }

  if (item.kind === 'curation_proposal') {
    return (
      <li>
        <CurationProposalCard
          isProcessing={item.status !== 'pending' || isLoading}
          onApprove={() => onApproveCurationProposal?.(item.id, item.proposal)}
          onReject={() => onRejectCurationProposal?.(item.id)}
          proposal={item.proposal}
          status={item.status}
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
      <div className="flex w-full justify-end">
        <p className="border-brand-accent/50 bg-brand-accent/20 text-brand-accent max-w-[90%] rounded-none border px-3.5 py-2 font-mono text-[0.65rem] leading-relaxed uppercase shadow-sm">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start">
      <div className="border-border/40 bg-background text-foreground/90 min-w-0 flex-1 overflow-x-auto rounded-none border px-3.5 py-2 font-mono text-[0.65rem] leading-relaxed uppercase shadow-sm">
        <MarkdownText text={text} />
        {streaming ? (
          <span
            aria-hidden
            className="bg-brand-accent stream-cursor ml-1 inline-block h-3.5 w-[2px] translate-y-0.5"
          />
        ) : null}
      </div>
    </div>
  );
});
