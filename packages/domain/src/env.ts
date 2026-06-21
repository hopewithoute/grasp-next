import { parse, urlString, v } from './validation';

const optionalString = v.optional(v.string());
const optionalNonEmptyString = v.optional(v.pipe(v.string(), v.minLength(1)));
const optionalPositiveInteger = v.optional(
  v.pipe(v.unknown(), v.transform(Number), v.number(), v.integer(), v.minValue(1))
);

export const serverEnvSchema = v.object({
  DATABASE_URL: urlString,
  BETTER_AUTH_SECRET: v.pipe(v.string(), v.minLength(32)),
  BETTER_AUTH_URL: urlString,
  AI_PROVIDER: optionalString,
  AI_MODEL: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: optionalString,
  XIAOMI_API_KEY: optionalString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  GOOGLE_EMBEDDING_MODEL: optionalString,
  GOOGLE_EMBEDDING_DIMENSIONS: optionalPositiveInteger,
  CONCEPT_EXTRACTOR_PROVIDER: optionalString,
  CONCEPT_EXTRACTOR_MODEL: optionalString,
  MASTRA_STORAGE_URL: urlString,
  EVIDENCE_KB_BASE_URL: optionalString,
  EVIDENCE_KB_API_KEY: optionalString,
  GOOGLE_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
  CLOUDFLARE_ACCOUNT_ID: optionalString,
  CLOUDFLARE_API_TOKEN: optionalString,
  JINA_API_KEY: optionalString,
  INGESTION_AGENT_MODEL: optionalString,
  REFINEMENT_AGENT_MODEL: optionalString,
});

export type ServerEnv = v.InferOutput<typeof serverEnvSchema>;

export function parseServerEnv(env: Record<string, string | undefined>): ServerEnv {
  return parse(serverEnvSchema, env);
}
