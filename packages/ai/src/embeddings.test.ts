import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { canUseEmbeddingModel, embedTexts } from './embeddings';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('embeddings', () => {
  it('detects OpenAI, OpenAI-compatible, or Google embedding configuration', () => {
    assert.equal(canUseEmbeddingModel({}), false);
    assert.equal(canUseEmbeddingModel({ OPENAI_API_KEY: 'key' }), true);
    assert.equal(
      canUseEmbeddingModel({
        OPENAI_COMPATIBLE_API_KEY: 'key',
        OPENAI_COMPATIBLE_BASE_URL: 'https://provider.example/v1',
      }),
      true
    );
    assert.equal(canUseEmbeddingModel({ GOOGLE_GENERATIVE_AI_API_KEY: 'key' }), true);
    assert.equal(canUseEmbeddingModel({ GEMINI_API_KEY: 'key' }), true);
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
    }) as typeof fetch;

    const embeddings = await embedTexts(['alpha', 'beta'], {
      OPENAI_API_KEY: 'test-key',
      OPENAI_EMBEDDING_MODEL: 'text-embedding-test',
    });

    assert.deepEqual(embeddings, [
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    assert.equal(calls[0]?.url, 'https://api.openai.com/v1/embeddings');
    assert.deepEqual(calls[0]?.body, {
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
    }) as typeof fetch;

    const embeddings = await embedTexts(['alpha', 'beta'], {
      GOOGLE_GENERATIVE_AI_API_KEY: 'google-key',
    });

    assert.deepEqual(embeddings, [
      [0.1, 0.2, 0.3],
      [0.1, 0.2, 0.3],
    ]);
    assert.equal(calls.length, 2);
    assert.equal(
      calls[0]?.url,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent'
    );
    assert.equal(calls[0]?.headers.get('x-goog-api-key'), 'google-key');
    assert.deepEqual(calls[0]?.body, {
      content: {
        parts: [{ text: 'alpha' }],
      },
      outputDimensionality: 1536,
    });
  });
});
