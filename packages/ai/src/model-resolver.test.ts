import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { patchDeepSeekReasoningRequest } from './model-resolver';

describe('patchDeepSeekReasoningRequest', () => {
  it('enables DeepSeek JSON mode only when requested, disables thinking, and sets default max tokens', () => {
    const patched = patchDeepSeekReasoningRequest(
      {
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Return JSON.' }],
          model: 'deepseek-chat',
        }),
      },
      new Map(),
      { forceJsonResponse: true }
    );

    const body = JSON.parse(String(patched?.body));

    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.thinking, { type: 'disabled' });
    assert.equal(body.max_tokens, 4096);
  });

  it('does not force JSON mode for plain-text refinement agents', () => {
    const patched = patchDeepSeekReasoningRequest(
      {
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Halo' }],
          model: 'deepseek-chat',
        }),
      },
      new Map(),
      { forceJsonResponse: false }
    );

    const body = JSON.parse(String(patched?.body));

    assert.equal(body.response_format, undefined);
    assert.deepEqual(body.thinking, { type: 'disabled' });
    assert.equal(body.max_tokens, 4096);
  });

  it('preserves explicit max tokens, response format, and thinking config', () => {
    const patched = patchDeepSeekReasoningRequest(
      {
        body: JSON.stringify({
          max_tokens: 1024,
          messages: [{ role: 'user', content: 'Return JSON.' }],
          response_format: { type: 'text' },
          thinking: { type: 'enabled' },
        }),
      },
      new Map()
    );

    const body = JSON.parse(String(patched?.body));

    assert.deepEqual(body.response_format, { type: 'text' });
    assert.deepEqual(body.thinking, { type: 'enabled' });
    assert.equal(body.max_tokens, 1024);
  });

  it('replays stored reasoning content for assistant tool-call messages', () => {
    const reasoningByToolCallId = new Map([['call-1', 'reasoned']]);
    const patched = patchDeepSeekReasoningRequest(
      {
        body: JSON.stringify({
          messages: [
            {
              role: 'assistant',
              tool_calls: [{ id: 'call-1' }],
            },
          ],
        }),
      },
      reasoningByToolCallId
    );

    const body = JSON.parse(String(patched?.body));

    assert.equal(body.messages[0].reasoning_content, 'reasoned');
  });
});
