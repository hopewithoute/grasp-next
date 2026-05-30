import { type ChatItem } from './types';

const STORAGE_KEY_PREFIX = 'grasp-chat-';

export function readStoredChatMessages(projectId: string): ChatItem[] {
  if (typeof window === 'undefined') return [];

  const saved = window.sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as ChatItem[]) : [];
  } catch (error) {
    console.error('Failed to parse chat history', error);
    return [];
  }
}

export function writeStoredChatMessages(projectId: string, messages: ChatItem[]): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, JSON.stringify(messages));
}
