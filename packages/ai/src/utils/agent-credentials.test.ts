import { describe, expect, it } from 'vitest';
import { canUseAgent } from './agent-credentials';

describe('canUseAgent', () => {
  it('returns false when no credentials are set', () => {
    expect(canUseAgent({})).toBe(false);
  });

  it('detects OpenAI key', () => {
    expect(canUseAgent({ OPENAI_API_KEY: 'sk-test' })).toBe(true);
  });

  it('detects Anthropic key', () => {
    expect(canUseAgent({ ANTHROPIC_API_KEY: 'sk-ant-test' })).toBe(true);
  });

  it('detects Anthropic auth token', () => {
    expect(canUseAgent({ ANTHROPIC_AUTH_TOKEN: 'token' })).toBe(true);
  });

  it('detects Gemini key', () => {
    expect(canUseAgent({ GEMINI_API_KEY: 'key' })).toBe(true);
  });

  it('detects Google Generative AI key', () => {
    expect(canUseAgent({ GOOGLE_GENERATIVE_AI_API_KEY: 'key' })).toBe(true);
  });

  it('detects Xiaomi key', () => {
    expect(canUseAgent({ XIAOMI_API_KEY: 'key' })).toBe(true);
  });

  it('detects AI_MODEL fallback', () => {
    expect(canUseAgent({ AI_MODEL: 'xiaomi/mimo-v2.5-pro' })).toBe(true);
  });

  it('detects OpenAI compatible config', () => {
    expect(
      canUseAgent({
        OPENAI_COMPATIBLE_BASE_URL: 'http://localhost:8080',
        OPENAI_COMPATIBLE_API_KEY: 'key',
      })
    ).toBe(true);
  });

  it('requires both base URL and key for OpenAI compatible', () => {
    expect(canUseAgent({ OPENAI_COMPATIBLE_BASE_URL: 'http://localhost:8080' })).toBe(false);
    expect(canUseAgent({ OPENAI_COMPATIBLE_API_KEY: 'key' })).toBe(false);
  });
});
