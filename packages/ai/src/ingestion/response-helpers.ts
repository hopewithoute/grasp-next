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
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  return JSON.parse(cleaned);
}
