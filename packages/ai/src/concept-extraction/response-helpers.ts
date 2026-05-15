export function getGeneratedText(response: { text?: unknown; content?: unknown }) {
  if (typeof response.text === "string") {
    return response.text;
  }

  if (typeof response.content === "string") {
    return response.content;
  }

  return "";
}

export function parseLooseJsonResponse(value: string) {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

export function normalizeLooseJsonResponse(value: unknown) {
  if (typeof value !== "object" || value === null || !("concepts" in value)) {
    return value;
  }

  const graph = value as {
    concepts?: unknown;
    relationships?: unknown;
  };

  if (!Array.isArray(graph.concepts)) {
    return value;
  }

  return {
    ...graph,
    concepts: graph.concepts.map((concept) => {
      if (typeof concept !== "object" || concept === null) {
        return concept;
      }

      const record = concept as Record<string, unknown>;
      const sourceEvidence = normalizeSourceEvidence(
        record.sourceEvidence ?? record.source_evidence
      );

      return {
        ...record,
        confidence: normalizeConfidence(record.confidence),
        sourceEvidence,
      };
    }),
    relationships: Array.isArray(graph.relationships) ? graph.relationships : [],
  };
}

function normalizeSourceEvidence(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return [
      {
        excerpt: value.trim(),
      },
    ];
  }

  return value;
}

function normalizeConfidence(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "high") {
    return 0.85;
  }

  if (normalized === "medium") {
    return 0.65;
  }

  if (normalized === "low") {
    return 0.35;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : value;
}
