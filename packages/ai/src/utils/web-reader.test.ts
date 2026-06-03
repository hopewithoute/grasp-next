import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractWebpageContent } from './web-reader';
import { env } from '../env';

// Allow tests to mutate env
vi.mock('../env', () => {
  return {
    env: {
      CLOUDFLARE_ACCOUNT_ID: undefined,
      CLOUDFLARE_API_TOKEN: undefined,
    },
  };
});

const mockGet = vi.fn();
vi.mock('node-wreq', () => ({
  createClient: vi.fn(() => ({
    get: mockGet,
  })),
}));

const originalFetch = globalThis.fetch;
const originalEnv = process.env;

describe('extractWebpageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('strips Jina AI prefix from URL', async () => {
    mockGet.mockResolvedValueOnce(
      new Response('<html><body>' + 'Hello long enough string to bypass SPA length check. '.repeat(10) + '</body></html>', { status: 200 }) as unknown as Response
    );

    const result = await extractWebpageContent('https://r.jina.ai/https://example.com');
    expect(result.trim()).toContain('Hello');
    expect(mockGet).toHaveBeenCalledWith('https://example.com');
  });

  it('returns text on successful Layer 1 extraction', async () => {
    mockGet.mockResolvedValueOnce(
      new Response('<html><body><h1>Test Title</h1><p>Some valid long content goes here to pass length check. '.repeat(10) + '</p></body></html>', {
        status: 200,
      }) as unknown as Response
    );

    const result = await extractWebpageContent('https://example.com');
    expect(result).toContain('TEST TITLE');
    expect(result.length).toBeGreaterThan(200);
  });

  it('falls back to Layer 2 if Layer 1 content is too short (SPA detection)', async () => {
    env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    env.CLOUDFLARE_API_TOKEN = 'test-token';

    // Layer 1 mock (too short)
    mockGet.mockResolvedValueOnce(
      new Response('<div id="root"></div>', { status: 200 }) as unknown as Response
    );

    // Layer 2 mock
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: '# Layer 2 Markdown' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await extractWebpageContent('https://example.com');
    expect(result).toBe('# Layer 2 Markdown');
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to Layer 2 if Layer 1 detects WAF challenge (Just a moment...)', async () => {
    env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    env.CLOUDFLARE_API_TOKEN = 'test-token';

    // Layer 1 mock (WAF)
    mockGet.mockResolvedValueOnce(
      new Response('<html><body><p>Just a moment...</p><p>Cloudflare Ray ID: 12345</p></body></html>', { status: 200 }) as unknown as Response
    );

    // Layer 2 mock
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: '# Extracted via CF' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await extractWebpageContent('https://example.com');
    expect(result).toBe('# Extracted via CF');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to Layer 2 if Layer 1 fails with non-200 status', async () => {
    env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    env.CLOUDFLARE_API_TOKEN = 'test-token';

    // Layer 1 mock (403 Forbidden)
    mockGet.mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }) as unknown as Response
    );

    // Layer 2 mock
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: '# Layer 2 success' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await extractWebpageContent('https://example.com');
    expect(result).toBe('# Layer 2 success');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws error if Layer 1 fails and Cloudflare credentials are missing', async () => {
    env.CLOUDFLARE_ACCOUNT_ID = undefined;
    env.CLOUDFLARE_API_TOKEN = undefined;

    // Layer 1 mock (403 Forbidden)
    mockGet.mockResolvedValueOnce(
      new Response('Forbidden', { status: 403, statusText: 'Forbidden' }) as unknown as Response
    );

    await expect(extractWebpageContent('https://example.com')).rejects.toThrow(
      /Failed to fetch URL: 403 Forbidden\. Please configure CLOUDFLARE_ACCOUNT_ID/
    );
  });
});
