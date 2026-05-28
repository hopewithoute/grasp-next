export type RecordedToolCall = {
  durationMs: number;
  error?: string;
  input: unknown;
  output?: unknown;
  toolName: string;
};

export type ToolRecording = {
  calls: RecordedToolCall[];
  proposals: unknown[];
};

export function createToolRecording(): ToolRecording {
  return {
    calls: [],
    proposals: [],
  };
}

export function wrapToolsWithRecorder<T extends Record<string, unknown>>(
  tools: T,
  recording: ToolRecording,
  overrides: Record<string, (...args: unknown[]) => Promise<unknown> | unknown> = {}
): T {
  return Object.fromEntries(
    Object.entries(tools).map(([key, tool]) => {
      if (!tool || typeof tool !== 'object' || typeof (tool as { execute?: unknown }).execute !== 'function') {
        return [key, tool];
      }

      const toolRecord = tool as { id?: string; execute: (...args: unknown[]) => Promise<unknown> };

      return [
        key,
        {
          ...toolRecord,
          execute: async (...args: unknown[]) => {
            const startedAt = Date.now();
            const toolName = toolRecord.id ?? key;
            try {
              const output = overrides[toolName]
                ? await overrides[toolName](...args)
                : await toolRecord.execute(...args);
              if (toolName === 'propose-graph-changes') {
                recording.proposals.push(args[0]);
              }
              recording.calls.push({
                durationMs: Date.now() - startedAt,
                input: args[0],
                output,
                toolName,
              });
              return output;
            } catch (error) {
              recording.calls.push({
                durationMs: Date.now() - startedAt,
                error: error instanceof Error ? error.message : String(error),
                input: args[0],
                toolName,
              });
              throw error;
            }
          },
        },
      ];
    })
  ) as T;
}
