import { createHash } from 'node:crypto';

export function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export function hashToolDescriptions(tools: Record<string, unknown>) {
  const summary = Object.entries(tools)
    .map(([key, tool]) => {
      const record = tool && typeof tool === 'object' ? (tool as Record<string, unknown>) : {};
      return {
        description: typeof record.description === 'string' ? record.description : null,
        id: typeof record.id === 'string' ? record.id : key,
        key,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return hashText(JSON.stringify(summary));
}
