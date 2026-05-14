import { z } from "zod";

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  AI_PROVIDER: z.string().optional(),
  AI_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  OPENAI_COMPATIBLE_PROVIDER_NAME: z.string().optional(),
  OPENAI_COMPATIBLE_BASE_URL: z.string().url().optional(),
  OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
  OPENAI_COMPATIBLE_MODEL: z.string().optional(),
  CONCEPT_EXTRACTOR_PROVIDER: z.string().optional(),
  CONCEPT_EXTRACTOR_MODEL: z.string().optional(),
  MASTRA_STORAGE_URL: z.string().url(),
  QUEUE_REDIS_URL: z.string().url(),
  QUEUE_PREFIX: z.string().min(1).default("grasp"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(env: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(env);
}
