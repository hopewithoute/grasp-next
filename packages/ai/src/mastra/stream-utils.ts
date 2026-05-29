import { Agent } from '@mastra/core/agent';

type StreamResult = Awaited<ReturnType<Agent['stream']>>;

export async function robustStream(
  agent: Agent,
  messages: unknown,
  options?: unknown
): Promise<StreamResult> {
  const maxRetries = 3;


  // Helper to peek at a stream without buffering the whole thing.
  const peekStream = async (stream: unknown) => {
    const streamObj = stream as { getReader?: () => ReadableStreamDefaultReader };
    if (!streamObj || typeof streamObj.getReader !== 'function') return { isEmpty: true, stream };
    
    const reader = streamObj.getReader!();
    const firstChunks: unknown[] = [];
    let isEmpty = true;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      firstChunks.push(value);
      
      // Determine if chunk has text or tool
      if (typeof value === 'string' && value.trim().length > 0) {
        isEmpty = false;
        break;
      }
      if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        if (obj.type === 'tool-call' || obj.toolName || (typeof obj.textDelta === 'string' && obj.textDelta.trim().length > 0)) {
          isEmpty = false;
          break;
        }
      }
    }
    
    const newStream = new ReadableStream({
      async start(controller) {
        for (const chunk of firstChunks) {
          controller.enqueue(chunk);
        }
        if (!isEmpty) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch (err) {
            controller.error(err);
          }
        }
        controller.close();
      }
    });
    
    // Support async iteration for textStream
    Object.assign(newStream, {
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of firstChunks) {
          yield chunk;
        }
        if (!isEmpty) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            yield value;
          }
        }
      }
    });
    
    return { isEmpty, stream: newStream };
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const currentMessages = Array.isArray(messages) ? [...messages] : messages;
    
    if (attempt > 1 && Array.isArray(currentMessages)) {
      currentMessages.push({
        role: 'user',
        content: 'SYSTEM WARNING: Your previous response was completely blank or invalid. You MUST follow the <thought> pattern before calling tools or answering. Do not return empty text.'
      });
    }

    let result: StreamResult;
    try {
      // We cast to never to bypass the TypeScript overloaded function inference limit
      result = await agent.stream(currentMessages as never, options as never);
    } catch (err: unknown) {
      if (attempt === maxRetries) throw err;
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`[robustStream] Attempt ${attempt} threw error: ${errorMessage}. Retrying...`);
      continue;
    }

    const [fullRes, textRes] = await Promise.all([
      peekStream(result.fullStream),
      peekStream(result.textStream)
    ]);
    
    // If no text was produced and no tools were called, it's a blank output failure.
    if (textRes.isEmpty && fullRes.isEmpty && attempt < maxRetries) {
      console.warn(`[robustStream] Attempt ${attempt} returned blank response (no text, no tools). Retrying...`);
      continue;
    }

    return {
      ...result,
      fullStream: fullRes.stream || result.fullStream,
      textStream: textRes.stream || result.textStream,
    } as StreamResult;
  }
  
  throw new Error("robustStream: Unreachable code");
}
