import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseLooseJsonResponse } from './response-helpers';

describe('parseLooseJsonResponse', () => {
  it('extracts the first complete JSON object and ignores trailing text', () => {
    const parsed = parseLooseJsonResponse(`
\`\`\`json
{"concepts":[{"conceptKey":"a"}],"relationships":[]}
\`\`\`
extra text
`);

    assert.deepEqual(parsed, {
      concepts: [{ conceptKey: 'a' }],
      relationships: [],
    });
  });

  it('throws a stable error for truncated JSON', () => {
    assert.throws(
      () => parseLooseJsonResponse('{"concepts":[{"conceptKey":"a"}],"relationships":['),
      /ingestion_agent_json_incomplete/
    );
  });
});
