import { afterEach, describe, expect, it } from 'vitest';
import { canUseEmbeddingModel, embedTexts } from './embeddings';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('embeddings', () => {
  it('detects OpenAI, OpenAI-compatible, or Google embedding configuration', () => {
    expect(canUseEmbeddingModel({})).toBe(false);
    expect(canUseEmbeddingModel({ AI_MODEL: 'xiaomi/mimo-v2.5-pro' })).toBe(false);
    expect(canUseEmbeddingModel({ OPENAI_API_KEY: 'key' })).toBe(true);
    expect(
      canUseEmbeddingModel({
        XIAOMI_API_KEY: 'key',
      })
    ).toBe(true);
    expect(canUseEmbeddingModel({ GOOGLE_GENERATIVE_AI_API_KEY: 'key' })).toBe(true);
    expect(canUseEmbeddingModel({ GEMINI_API_KEY: 'key' })).toBe(true);
  });

  it('requests OpenAI-compatible embeddings and returns them in input order', async () => {
    const calls: Array<{ body: unknown; url: string }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({
        body: init?.body ? JSON.parse(String(init.body)) : null,
        url: String(input),
      });

      return new Response(
        JSON.stringify({
          data: [
            { embedding: [0.3, 0.4], index: 1 },
            { embedding: [0.1, 0.2], index: 0 },
          ],
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }
      );
    });

    const embeddings = await embedTexts(['alpha', 'beta'], {
      OPENAI_API_KEY: 'test-key',
      OPENAI_EMBEDDING_MODEL: 'text-embedding-test',
    });

    expect(embeddings).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/embeddings');
    expect(calls[0]?.body).toEqual({
      input: ['alpha', 'beta'],
      model: 'text-embedding-test',
    });
  });

  it('requests Google embeddings with the schema-compatible output dimension', async () => {
    const calls: Array<{ body: unknown; headers: Headers; url: string }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({
        body: init?.body ? JSON.parse(String(init.body)) : null,
        headers: new Headers(init?.headers),
        url: String(input),
      });

      return new Response(
        JSON.stringify({
          embedding: {
            values: [0.1, 0.2, 0.3],
          },
        }),
        {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }
      );
    });

    const embeddings = await embedTexts(['alpha', 'beta'], {
      GOOGLE_GENERATIVE_AI_API_KEY: 'google-key',
    });

    expect(embeddings).toEqual([
      [0.1, 0.2, 0.3],
      [0.1, 0.2, 0.3],
    ]);
    expect(calls.length).toBe(2);
    expect(calls[0]?.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent'
    );
    expect(calls[0]?.headers.get('x-goog-api-key')).toBe('google-key');
    expect(calls[0]?.body).toEqual({
      content: {
        parts: [{ text: 'alpha' }],
      },
      outputDimensionality: 1536,
    });
  });
});
