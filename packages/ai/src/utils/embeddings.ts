export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export const DEFAULT_GOOGLE_EMBEDDING_MODEL = 'gemini-embedding-001';
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_XIAOMI_BASE_URL = 'https://token-plan-sgp.xiaomimimo.com/v1';

export function canUseEmbeddingModel(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.OPENAI_API_KEY ||
    env.OPENAI_EMBEDDING_API_KEY ||
    env.XIAOMI_API_KEY ||
    (env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_API_KEY) ||
    env.GOOGLE_GENERATIVE_AI_API_KEY ||
    env.GEMINI_API_KEY
  );
}

export async function embedTexts(
  texts: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<number[][]> {
  if (!texts.length) {
    return [];
  }

  if (canUseGoogleEmbeddings(env)) {
    return embedTextsWithGoogle(texts, env);
  }

  return embedTextsWithOpenAiCompatible(texts, env);
}

export async function embedText(text: string, env: NodeJS.ProcessEnv = process.env) {
  const [embedding] = await embedTexts([text], env);
  return embedding;
}

async function embedTextsWithOpenAiCompatible(texts: string[], env: NodeJS.ProcessEnv) {
  const endpoint = resolveEmbeddingEndpoint(env);
  const apiKey = resolveEmbeddingApiKey(env);
  const model = env.OPENAI_EMBEDDING_MODEL ?? env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;

  const response = await fetch(endpoint, {
    body: JSON.stringify({
      input: texts,
      model,
    }),
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`embedding_request_failed:${response.status}:${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: unknown; index?: number }>;
  };

  if (!Array.isArray(payload.data)) {
    throw new Error('embedding_response_missing_data');
  }

  const embeddings = new Array<number[]>(texts.length);
  for (const item of payload.data) {
    if (typeof item.index !== 'number' || !Array.isArray(item.embedding)) {
      throw new Error('embedding_response_invalid_item');
    }

    embeddings[item.index] = item.embedding.map((value) => Number(value));
  }

  if (embeddings.some((embedding) => !embedding)) {
    throw new Error('embedding_response_missing_index');
  }

  return embeddings;
}

async function embedTextsWithGoogle(texts: string[], env: NodeJS.ProcessEnv) {
  const apiKey = resolveGoogleEmbeddingApiKey(env);
  const model = env.GOOGLE_EMBEDDING_MODEL ?? DEFAULT_GOOGLE_EMBEDDING_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;
  const outputDimensionality = Number(
    env.GOOGLE_EMBEDDING_DIMENSIONS ?? DEFAULT_EMBEDDING_DIMENSIONS
  );
  const embeddings: number[][] = [];

  for (const text of texts) {
    const response = await fetch(endpoint, {
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
        outputDimensionality,
      }),
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      method: 'POST',
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`embedding_request_failed:${response.status}:${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      embedding?: { values?: unknown };
    };

    if (!Array.isArray(payload.embedding?.values)) {
      throw new Error('embedding_response_missing_google_values');
    }

    embeddings.push(payload.embedding.values.map((value) => Number(value)));
  }

  return embeddings;
}

function resolveEmbeddingEndpoint(env: NodeJS.ProcessEnv) {
  if (env.XIAOMI_API_KEY && env.XIAOMI_BASE_URL) {
    return `${env.XIAOMI_BASE_URL.replace(/\/$/, '')}/embeddings`;
  }

  if (env.XIAOMI_API_KEY) {
    return `${DEFAULT_XIAOMI_BASE_URL}/embeddings`;
  }

  if (env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_API_KEY) {
    return `${env.OPENAI_COMPATIBLE_BASE_URL.replace(/\/$/, '')}/embeddings`;
  }

  if (env.OPENAI_API_KEY || env.OPENAI_EMBEDDING_API_KEY) {
    return 'https://api.openai.com/v1/embeddings';
  }

  throw new Error('Embedding provider credentials are required.');
}

function resolveEmbeddingApiKey(env: NodeJS.ProcessEnv) {
  return (
    env.OPENAI_EMBEDDING_API_KEY ??
    env.OPENAI_COMPATIBLE_API_KEY ??
    env.XIAOMI_API_KEY ??
    env.OPENAI_API_KEY ??
    requireEmbeddingApiKey()
  );
}

function requireEmbeddingApiKey(): never {
  throw new Error('Embedding provider API key is required.');
}

function canUseGoogleEmbeddings(env: NodeJS.ProcessEnv) {
  return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY);
}

function resolveGoogleEmbeddingApiKey(env: NodeJS.ProcessEnv) {
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return env.GOOGLE_GENERATIVE_AI_API_KEY;
  }

  if (env.GEMINI_API_KEY) {
    return env.GEMINI_API_KEY;
  }

  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY is required.');
}
