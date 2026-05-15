export function isUnsupportedStructuredOutputError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /response_format type is unavailable now/i.test(error.message);
}
