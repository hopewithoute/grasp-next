import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canUseAgent } from './agent-credentials';

describe('canUseAgent', () => {
  it('returns false when no credentials are set', () => {
    assert.equal(canUseAgent({}), false);
  });

  it('detects OpenAI key', () => {
    assert.equal(canUseAgent({ OPENAI_API_KEY: 'sk-test' }), true);
  });

  it('detects Anthropic key', () => {
    assert.equal(canUseAgent({ ANTHROPIC_API_KEY: 'sk-ant-test' }), true);
  });

  it('detects Anthropic auth token', () => {
    assert.equal(canUseAgent({ ANTHROPIC_AUTH_TOKEN: 'token' }), true);
  });

  it('detects Gemini key', () => {
    assert.equal(canUseAgent({ GEMINI_API_KEY: 'key' }), true);
  });

  it('detects Google Generative AI key', () => {
    assert.equal(canUseAgent({ GOOGLE_GENERATIVE_AI_API_KEY: 'key' }), true);
  });

  it('detects Xiaomi key', () => {
    assert.equal(canUseAgent({ XIAOMI_API_KEY: 'key' }), true);
  });

  it('detects AI_MODEL fallback', () => {
    assert.equal(canUseAgent({ AI_MODEL: 'xiaomi/mimo-v2.5-pro' }), true);
  });

  it('detects OpenAI compatible config', () => {
    assert.equal(
      canUseAgent({
        OPENAI_COMPATIBLE_BASE_URL: 'http://localhost:8080',
        OPENAI_COMPATIBLE_API_KEY: 'key',
      }),
      true
    );
  });

  it('requires both base URL and key for OpenAI compatible', () => {
    assert.equal(canUseAgent({ OPENAI_COMPATIBLE_BASE_URL: 'http://localhost:8080' }), false);
    assert.equal(canUseAgent({ OPENAI_COMPATIBLE_API_KEY: 'key' }), false);
  });
});
