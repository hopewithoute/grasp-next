import { useState, useEffect, useSyncExternalStore } from 'react';
import { type ConceptRow } from './types';
import { type DifficultyFilter } from './types';
import { type ProposalPayload } from './proposal-card';

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
    getServerHydrationSnapshot,
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
  pendingProposals: ProposalPayload[];
};

export function useConceptGraphState(concepts: ConceptRow[]) {
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(concepts[0]?.id ?? null);
  const [chatContextConceptIds, setChatContextConceptIds] = useState<string[]>([]);
  const [isInventoryCollapsed, setIsInventoryCollapsed] = useState<boolean>(true);
  const [isRefinementCollapsed, setIsRefinementCollapsed] = useState<boolean>(false);
  const [hoveredChatConceptId, setHoveredChatConceptId] = useState<string | null>(null);
  const [pendingProposals, setPendingProposals] = useState<ProposalPayload[]>([]);

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
  };
}
