import { z } from 'zod';
import { loadAiEnv } from './load-env';

// Pastikan .env sudah ter-load (terutama saat dijalankan di luar framework seperti Next.js)
loadAiEnv();

const envSchema = z.object({
  // Database / Storage
  DATABASE_URL: z.string().optional(),
  MASTRA_STORAGE_URL: z.string().optional(),

  // LLM API Keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  XIAOMI_API_KEY: z.string().optional(),
  
  // Jina AI Ecosystem
  JINA_API_KEY: z.string().optional(),

  // Model Defaults
  AI_MODEL: z.string().default('xiaomi/mimo-v2.5-pro'),
  INGESTION_AGENT_MODEL: z.string().optional(),
  REFINEMENT_AGENT_MODEL: z.string().optional(),

  // Cloudflare Web Reader (Browser Run)
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
});

export const env = envSchema.parse(process.env);
