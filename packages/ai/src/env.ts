import { parse, v } from '@grasp/domain';
import { loadAiEnv } from './load-env';

// Pastikan .env sudah ter-load (terutama saat dijalankan di luar framework seperti Next.js)
loadAiEnv();

const optionalString = v.optional(v.string());

const envSchema = v.object({
  // Database / Storage
  DATABASE_URL: optionalString,
  MASTRA_STORAGE_URL: optionalString,

  // LLM API Keys
  OPENAI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  XIAOMI_API_KEY: optionalString,

  // Jina AI Ecosystem
  JINA_API_KEY: optionalString,

  // Model Defaults
  AI_MODEL: v.optional(v.string(), 'xiaomi/mimo-v2.5-pro'),
  INGESTION_AGENT_MODEL: optionalString,
  REFINEMENT_AGENT_MODEL: optionalString,

  // Cloudflare Web Reader (Browser Run)
  CLOUDFLARE_ACCOUNT_ID: optionalString,
  CLOUDFLARE_API_TOKEN: optionalString,
});

export const env = parse(envSchema, process.env);
