/**
 * Centralized LLM credential availability check.
 *
 * Every consumer (evals, ingestion runner, etc.) should import this
 * instead of duplicating env-var probe logic.
 */
export function canUseAgent(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.OPENAI_API_KEY ||
      env.ANTHROPIC_API_KEY ||
      env.ANTHROPIC_AUTH_TOKEN ||
      env.GEMINI_API_KEY ||
      env.GOOGLE_GENERATIVE_AI_API_KEY ||
      env.XIAOMI_API_KEY ||
      env.AI_MODEL ||
      (env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_API_KEY)
  );
}
