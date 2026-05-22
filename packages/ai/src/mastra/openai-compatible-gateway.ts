import { createOpenAI } from '@ai-sdk/openai';
import { MastraModelGateway, type GatewayLanguageModel, type ProviderConfig } from '@mastra/core/llm';

export class OpenAICompatibleGateway extends MastraModelGateway {
  readonly id = 'grasp-openai-compatible';
  readonly name: string;

  constructor(
    private readonly config: {
      apiKey: string;
      baseURL: string;
      models: string[];
      providerName: string;
    }
  ) {
    super();
    this.name = config.providerName;
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      [this.config.providerName]: {
        apiKeyEnvVar: 'OPENAI_COMPATIBLE_API_KEY',
        gateway: this.id,
        models: this.config.models,
        name: this.config.providerName,
        url: this.config.baseURL,
      },
    };
  }

  buildUrl() {
    return this.config.baseURL;
  }

  async getApiKey() {
    return this.config.apiKey;
  }

  resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
    headers,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): GatewayLanguageModel {
    const openaiCompatible = createOpenAI({
      apiKey,
      baseURL: this.config.baseURL,
      headers,
      name: providerId,
    });

    return openaiCompatible.chat(modelId);
  }
}

export function createOpenAICompatibleGatewayFromEnv(env: NodeJS.ProcessEnv) {
  if (!env.OPENAI_COMPATIBLE_BASE_URL || !env.OPENAI_COMPATIBLE_API_KEY) {
    return null;
  }

  const models = [
    env.REFINEMENT_AGENT_MODEL,
    env.INGESTION_AGENT_MODEL,
    env.OPENAI_COMPATIBLE_MODEL,
    env.AI_MODEL,
  ].filter((model): model is string => Boolean(model));

  return new OpenAICompatibleGateway({
    apiKey: env.OPENAI_COMPATIBLE_API_KEY,
    baseURL: env.OPENAI_COMPATIBLE_BASE_URL,
    models: Array.from(new Set(models.length > 0 ? models : ['default'])),
    providerName: env.OPENAI_COMPATIBLE_PROVIDER_NAME ?? 'openai-compatible',
  });
}
