export type MastraStreamChunk = {
  type?: unknown;
  payload?: unknown;
  textDelta?: unknown;
};

export function readMastraTextDelta(chunk: MastraStreamChunk): string | null {
  if (chunk.type !== 'text-delta') {
    return null;
  }

  if (typeof chunk.textDelta === 'string') {
    return chunk.textDelta;
  }

  const payload = chunk.payload;
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const text = (payload as Record<string, unknown>).text;
  return typeof text === 'string' ? text : null;
}
