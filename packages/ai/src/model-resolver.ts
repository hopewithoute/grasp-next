import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { aiProviderConfig } from './model-config';

export type AiModelProvider = 'anthropic' | 'openai' | 'openai-compatible';
export type AgentModelKey = 'ingestionAgent';

export function canUseAgentModel(agent: AgentModelKey, env: NodeJS.ProcessEnv = process.env) {
  const provider = resolveAgentProvider(agent, env);

  if (provider === 'openai-compatible') {
    return Boolean(env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_API_KEY);
  }

  if (provider === 'anthropic') {
    return Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
  }

  return Boolean(env.OPENAI_API_KEY);
}

export function resolveAgentModel(agent: AgentModelKey, env: NodeJS.ProcessEnv) {
  const provider = resolveAgentProvider(agent, env);

  if (provider === 'openai-compatible') {
    const modelName = resolveAgentModelName(agent, provider, env);
    const openAICompatible = createOpenAI({
      name: env.OPENAI_COMPATIBLE_PROVIDER_NAME ?? 'openai-compatible',
      baseURL: requireEnv(env.OPENAI_COMPATIBLE_BASE_URL, 'OPENAI_COMPATIBLE_BASE_URL'),
      apiKey: requireEnv(env.OPENAI_COMPATIBLE_API_KEY, 'OPENAI_COMPATIBLE_API_KEY'),
      fetch: isDeepSeekModel(modelName) ? createDeepSeekReasoningFetch() : undefined,
    });

    return openAICompatible.chat(modelName);
  }

  if (provider === 'anthropic') {
    const apiKey = env.ANTHROPIC_API_KEY;
    const authToken = env.ANTHROPIC_AUTH_TOKEN;

    if (!apiKey && !authToken) {
      throw new Error('ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is required.');
    }

    const anthropic = createAnthropic({
      ...(authToken ? { authToken } : { apiKey: requireEnv(apiKey, 'ANTHROPIC_API_KEY') }),
      baseURL: env.ANTHROPIC_BASE_URL,
    });

    return anthropic(resolveAgentModelName(agent, provider, env));
  }

  return resolveAgentModelName(agent, provider, env);
}

function resolveAgentProvider(agent: AgentModelKey, env: NodeJS.ProcessEnv): AiModelProvider {
  const configuredProvider = resolveAgentEnv(agent, 'PROVIDER', env) ?? env.AI_PROVIDER;

  if (isAiModelProvider(configuredProvider)) {
    return configuredProvider;
  }

  if (env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_API_KEY) {
    return 'openai-compatible';
  }

  if (env.OPENAI_API_KEY) {
    return 'openai';
  }

  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) {
    return 'anthropic';
  }

  return 'openai';
}

function resolveAgentModelName(
  agent: AgentModelKey,
  provider: AiModelProvider,
  env: NodeJS.ProcessEnv
) {
  const configuredModel = resolveAgentEnv(agent, 'MODEL', env) ?? env.AI_MODEL;

  if (configuredModel) {
    return configuredModel;
  }

  if (provider === 'openai-compatible') {
    return env.OPENAI_COMPATIBLE_MODEL ?? aiProviderConfig.openai.defaultModel;
  }

  if (provider === 'anthropic') {
    return env.ANTHROPIC_MODEL ?? aiProviderConfig.anthropic.defaultModel;
  }

  return env.OPENAI_MODEL ?? aiProviderConfig.openai.defaultModel;
}

function resolveAgentEnv(
  agent: AgentModelKey,
  suffix: 'MODEL' | 'PROVIDER',
  env: NodeJS.ProcessEnv
) {
  return env[`${toScreamingSnakeCase(agent)}_${suffix}`];
}

function toScreamingSnakeCase(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}

function isAiModelProvider(value: string | undefined): value is AiModelProvider {
  return value === 'anthropic' || value === 'openai' || value === 'openai-compatible';
}

function requireEnv(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function isDeepSeekModel(modelName: string) {
  return modelName.toLowerCase().includes('deepseek');
}

function createDeepSeekReasoningFetch(): typeof fetch {
  const reasoningByToolCallId = new Map<string, string>();

  return async (input, init) => {
    const patchedInit = patchDeepSeekReasoningRequest(init, reasoningByToolCallId);
    const response = await fetch(input, patchedInit);

    if (!isJsonResponse(response)) {
      return response;
    }

    const body = await response.clone().json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return response;
    }

    rememberDeepSeekReasoning(body, reasoningByToolCallId);

    return new Response(JSON.stringify(body), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

function patchDeepSeekReasoningRequest(
  init: RequestInit | undefined,
  reasoningByToolCallId: Map<string, string>
): RequestInit | undefined {
  if (!init || typeof init.body !== 'string') {
    return init;
  }

  const body = tryParseJson(init.body) as {
    messages?: Array<{
      role?: string;
      reasoning_content?: string;
      tool_calls?: Array<{ id?: string }>;
    }>;
  };

  if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) {
    return init;
  }

  let changed = false;
  for (const message of body.messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.tool_calls)) {
      continue;
    }

    if (message.reasoning_content != null) {
      continue;
    }

    const reasoning = message.tool_calls
      .map((toolCall) => (toolCall.id ? reasoningByToolCallId.get(toolCall.id) : undefined))
      .find((value): value is string => value != null);

    message.reasoning_content = reasoning ?? '';
    changed = true;
  }

  return changed ? { ...init, body: JSON.stringify(body) } : init;
}

function rememberDeepSeekReasoning(
  body: unknown,
  reasoningByToolCallId: Map<string, string>
) {
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    return;
  }

  for (const choice of choices) {
    const message = (choice as { message?: unknown }).message;
    if (!message || typeof message !== 'object') {
      continue;
    }

    const reasoning = (message as { reasoning_content?: unknown }).reasoning_content;
    const toolCalls = (message as { tool_calls?: unknown }).tool_calls;
    if (typeof reasoning !== 'string' || !Array.isArray(toolCalls)) {
      continue;
    }

    for (const toolCall of toolCalls) {
      const id = (toolCall as { id?: unknown }).id;
      if (typeof id === 'string') {
        reasoningByToolCallId.set(id, reasoning);
      }
    }
  }
}

function isJsonResponse(response: Response) {
  return response.headers.get('content-type')?.includes('application/json') ?? false;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
