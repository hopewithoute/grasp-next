import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { aiProviderConfig } from "./model-config";

export type AiModelProvider = "anthropic" | "openai" | "openai-compatible";
export type AgentModelKey = "conceptExtractor";

export function canUseAgentModel(
  agent: AgentModelKey,
  env: NodeJS.ProcessEnv = process.env
) {
  const provider = resolveAgentProvider(agent, env);

  if (provider === "openai-compatible") {
    return Boolean(env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_API_KEY);
  }

  if (provider === "anthropic") {
    return Boolean(env.ANTHROPIC_API_KEY);
  }

  return Boolean(env.OPENAI_API_KEY);
}

export function resolveAgentModel(
  agent: AgentModelKey,
  env: NodeJS.ProcessEnv = process.env
) {
  const provider = resolveAgentProvider(agent, env);

  if (provider === "openai-compatible") {
    const openAICompatible = createOpenAI({
      name: env.OPENAI_COMPATIBLE_PROVIDER_NAME ?? "openai-compatible",
      baseURL: requireEnv(
        env.OPENAI_COMPATIBLE_BASE_URL,
        "OPENAI_COMPATIBLE_BASE_URL"
      ),
      apiKey: requireEnv(
        env.OPENAI_COMPATIBLE_API_KEY,
        "OPENAI_COMPATIBLE_API_KEY"
      ),
    });

    return openAICompatible.chat(resolveAgentModelName(agent, provider, env));
  }

  if (provider === "anthropic") {
    const anthropic = createAnthropic({
      apiKey: requireEnv(env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY"),
    });

    return anthropic(resolveAgentModelName(agent, provider, env));
  }

  return resolveAgentModelName(agent, provider, env);
}

function resolveAgentProvider(
  agent: AgentModelKey,
  env: NodeJS.ProcessEnv
): AiModelProvider {
  const configuredProvider =
    resolveAgentEnv(agent, "PROVIDER", env) ?? env.AI_PROVIDER;

  if (isAiModelProvider(configuredProvider)) {
    return configuredProvider;
  }

  if (env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_API_KEY) {
    return "openai-compatible";
  }

  if (env.OPENAI_API_KEY) {
    return "openai";
  }

  if (env.ANTHROPIC_API_KEY) {
    return "anthropic";
  }

  return "openai";
}

function resolveAgentModelName(
  agent: AgentModelKey,
  provider: AiModelProvider,
  env: NodeJS.ProcessEnv
) {
  const configuredModel = resolveAgentEnv(agent, "MODEL", env) ?? env.AI_MODEL;

  if (configuredModel) {
    return configuredModel;
  }

  if (provider === "openai-compatible") {
    return env.OPENAI_COMPATIBLE_MODEL ?? aiProviderConfig.openai.defaultModel;
  }

  if (provider === "anthropic") {
    return env.ANTHROPIC_MODEL ?? aiProviderConfig.anthropic.defaultModel;
  }

  return env.OPENAI_MODEL ?? aiProviderConfig.openai.defaultModel;
}

function resolveAgentEnv(
  agent: AgentModelKey,
  suffix: "MODEL" | "PROVIDER",
  env: NodeJS.ProcessEnv
) {
  return env[`${toScreamingSnakeCase(agent)}_${suffix}`];
}

function toScreamingSnakeCase(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

function isAiModelProvider(value: string | undefined): value is AiModelProvider {
  return (
    value === "anthropic" ||
    value === "openai" ||
    value === "openai-compatible"
  );
}

function requireEnv(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}
