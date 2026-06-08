import PQueue from 'p-queue';

// Global queue with a strict concurrency limit for LLM requests
// Limited to exactly 1 request per second to prevent aggressive rate limits.
const llmQueue = new PQueue({
  concurrency: 1,
  intervalCap: 10,
  interval: 1000,
});

// Keep a reference to the original native fetch
const originalFetch = global.fetch;

/**
 * Intercepts global.fetch to queue outbound LLM requests.
 * This ensures that all Vercel AI SDK requests, including internal tool
 * loops and retries, respect the global concurrency limit.
 */
export function setupGlobalLlmQueue() {
  // Prevent double-patching if called multiple times
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((global.fetch as any).__llm_queue_patched) {
    return;
  }

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Determine the URL string safely
    const urlStr =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // Identify LLM API endpoints.
    // Matches common Vercel AI SDK domains and standard OpenAI-compatible paths.
    const isLlmRequest =
      urlStr.includes('api.openai.com') ||
      urlStr.includes('api.anthropic.com') ||
      urlStr.includes('api.deepseek.com') ||
      urlStr.includes('generativelanguage.googleapis.com') ||
      urlStr.includes('/v1/chat/completions') ||
      urlStr.includes('/v1/embeddings');

    if (isLlmRequest) {
      // Add the fetch call to the queue and return its promise
      return llmQueue.add(async () => originalFetch(input, init));
    }

    // Pass through non-LLM requests immediately
    return originalFetch(input, init);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global.fetch as any).__llm_queue_patched = true;
  console.warn('[GlobalLlmQueue] Successfully patched global.fetch for LLM rate limiting.');
}
