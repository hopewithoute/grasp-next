function readToolName(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  return typeof record.toolName === 'string' ? record.toolName : null;
}

function readToolCalls(value: unknown): unknown[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  return Array.isArray(record.toolCalls) ? record.toolCalls : [];
}

export function containsGraphMutationToolCall(event: unknown): boolean {
  const mutationTools = [
    'propose-graph-changes',
  ];

  const eventRecord =
    event && typeof event === 'object' ? (event as Record<string, unknown>) : {};
  const steps = Array.isArray(eventRecord.steps) ? eventRecord.steps : [];
  const rootToolCalls = readToolCalls(event);

  if (steps.length > 0) {
    return steps.some((step) =>
      readToolCalls(step).some((call) => {
        const toolName = readToolName(call);
        return toolName ? mutationTools.includes(toolName) : false;
      })
    );
  }

  return rootToolCalls.some((call) => {
    const toolName = readToolName(call);
    return toolName ? mutationTools.includes(toolName) : false;
  });
}
