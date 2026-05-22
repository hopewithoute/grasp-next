export function getGeneratedText(response: { text?: unknown; content?: unknown }) {
  if (typeof response.text === 'string') {
    return response.text;
  }

  if (typeof response.content === 'string') {
    return response.content;
  }

  return '';
}

export function parseLooseJsonResponse(value: string) {
  let cleaned = value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  cleaned = extractJsonObject(cleaned);

  return JSON.parse(cleaned);
}

function extractJsonObject(value: string) {
  const firstBrace = value.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('embedding_agent_json_missing_object');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = firstBrace; index < value.length; index += 1) {
    const char = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return value.slice(firstBrace, index + 1);
      }
    }
  }

  throw new Error('ingestion_agent_json_incomplete');
}
