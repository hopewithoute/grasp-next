import { useEffect, useState, useSyncExternalStore } from 'react';
import { type ConceptRow, type DifficultyFilter, type ProposalPayload } from '../types';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function subscribeToHydration(onStoreChange: () => void) {
  queueMicrotask(onStoreChange);
  return () => {};
}

function getClientHydrationSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

export function useClientHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot
  );
}

export type ConceptGraphState = {
  pendingSelectedId: string | null;
  chatContextConceptIds: string[];
  searchQuery: string;
  difficultyFilter: DifficultyFilter;
  isInventoryCollapsed: boolean;
  isRefinementCollapsed: boolean;
  hoveredChatConceptId: string | null;
  pendingProposals: PendingProposal[];
};

export type PendingProposal = ProposalPayload & { id: string };

export function useConceptGraphState(concepts: ConceptRow[]) {
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(
    concepts[0]?.id ?? null
  );
  const [chatContextConceptIds, setChatContextConceptIds] = useState<string[]>([]);
  const [isInventoryCollapsed, setIsInventoryCollapsed] = useState(false);
  const [isRefinementCollapsed, setIsRefinementCollapsed] = useState(true);
  const [hoveredChatConceptId, setHoveredChatConceptId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');

  // Load proposals from server (mock for MVP if needed, assuming handled elsewhere)
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>([]);

  return {
    pendingSelectedId,
    setPendingSelectedId,
    chatContextConceptIds,
    setChatContextConceptIds,
    isInventoryCollapsed,
    setIsInventoryCollapsed,
    isRefinementCollapsed,
    setIsRefinementCollapsed,
    hoveredChatConceptId,
    setHoveredChatConceptId,
    pendingProposals,
    setPendingProposals,
    viewMode,
    setViewMode,
  };
}
