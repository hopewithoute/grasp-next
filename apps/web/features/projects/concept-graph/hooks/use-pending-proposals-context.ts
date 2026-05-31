'use client';

import { createContext, useContext, useMemo } from 'react';
import { type ChatItem } from '../types';
import { type PendingProposal } from './use-concept-graph-state';

export type PendingProposalsContextType = {
  pendingProposals: PendingProposal[];
};

export const PendingProposalsContext = createContext<PendingProposalsContextType>({
  pendingProposals: [],
});

export function usePendingProposals() {
  return useContext(PendingProposalsContext);
}

/**
 * Derives pending proposals from chat items and messages,
 * and returns a stable context value. No useEffect needed.
 */
export function useDerivedPendingProposals(
  items: ChatItem[],
  messages: ChatItem[],
  setPendingProposals: React.Dispatch<React.SetStateAction<PendingProposal[]>>
): PendingProposalsContextType {
  const proposals = useMemo(
    () =>
      [...items, ...messages]
        .filter(
          (item): item is Extract<ChatItem, { kind: 'proposal' }> =>
            item.kind === 'proposal' && item.status === 'pending'
        )
        .map((item) => ({ ...item.proposal, id: item.id })),
    [items, messages]
  );

  // Sync derived value to parent state during render (React bails out if unchanged)
  setPendingProposals(proposals);

  return useMemo(() => ({ pendingProposals: proposals }), [proposals]);
}
