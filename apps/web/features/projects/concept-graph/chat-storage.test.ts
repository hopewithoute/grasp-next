import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { type ChatItem } from './types';
import { readStoredChatMessages, writeStoredChatMessages } from './chat-storage';

// Mock sessionStorage for Node environment
const store = new Map<string, string>();

Object.defineProperty(globalThis, 'window', {
  value: {
    sessionStorage: {
      get length() { return store.size; },
      clear() { store.clear(); },
      getItem(key: string) { return store.get(key) ?? null; },
      setItem(key: string, value: string) { store.set(key, value); },
      removeItem(key: string) { store.delete(key); },
      key(index: number) { return [...store.keys()][index] ?? null; },
    },
  },
  writable: true,
});

beforeEach(() => {
  store.clear();
});

describe('readStoredChatMessages', () => {
  it('returns empty array when no stored data', () => {
    const result = readStoredChatMessages('project-1');
    assert.deepEqual(result, []);
  });

  it('returns stored messages', () => {
    const messages: ChatItem[] = [
      { id: 'msg-1', kind: 'message', role: 'user', text: 'Hello', streaming: false },
    ];
    store.set('grasp-chat-project-1', JSON.stringify(messages));

    const result = readStoredChatMessages('project-1');
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, 'msg-1');
  });

  it('returns empty array for invalid JSON', () => {
    store.set('grasp-chat-project-1', 'not-json');
    const result = readStoredChatMessages('project-1');
    assert.deepEqual(result, []);
  });

  it('returns empty array for non-array JSON', () => {
    store.set('grasp-chat-project-1', '{"foo": "bar"}');
    const result = readStoredChatMessages('project-1');
    assert.deepEqual(result, []);
  });
});

describe('writeStoredChatMessages', () => {
  it('writes messages to sessionStorage', () => {
    const messages: ChatItem[] = [
      { id: 'msg-1', kind: 'message', role: 'agent', text: 'Hi', streaming: false },
    ];
    writeStoredChatMessages('project-2', messages);

    const stored = store.get('grasp-chat-project-2');
    assert.ok(stored);
    const parsed = JSON.parse(stored);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, 'msg-1');
  });

  it('overwrites previous messages', () => {
    const first: ChatItem[] = [
      { id: 'msg-1', kind: 'message', role: 'user', text: 'First', streaming: false },
    ];
    const second: ChatItem[] = [
      { id: 'msg-2', kind: 'message', role: 'agent', text: 'Second', streaming: false },
    ];
    writeStoredChatMessages('project-3', first);
    writeStoredChatMessages('project-3', second);

    const result = readStoredChatMessages('project-3');
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, 'msg-2');
  });
});
