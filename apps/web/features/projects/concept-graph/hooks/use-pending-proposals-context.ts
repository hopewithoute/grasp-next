'use client';

import { createContext, use, useMemo } from 'react';
import { type ProposalPayload, type ChatItem } from '../types';

type PendingProposalsContextValue = {
  pendingProposals: ProposalPayload[];
};

export const PendingProposalsContext = createContext<PendingProposalsContextValue>({
  pendingProposals: [],
});

export function usePendingProposals() {
  return use(PendingProposalsContext);
}

/**
 * Derives pending proposals from chat items and messages,
 * and returns a stable context value. No useEffect needed.
 */
export function useDerivedPendingProposals(
  items: ChatItem[],
  messages: ChatItem[],
  setPendingProposals: React.Dispatch<React.SetStateAction<ProposalPayload[]>>
): PendingProposalsContextValue {
  const proposals = useMemo(
    () =>
      [...items, ...messages]
        .filter(
          (item): item is Extract<ChatItem, { kind: 'proposal' }> =>
            item.kind === 'proposal' && item.status === 'pending'
        )
        .map((item) => item.proposal),
    [items, messages]
  );

  // Sync derived value to parent state during render (React bails out if unchanged)
  setPendingProposals(proposals);

  return useMemo(() => ({ pendingProposals: proposals }), [proposals]);
}
