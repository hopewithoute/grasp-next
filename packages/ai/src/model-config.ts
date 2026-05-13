export const aiProviderConfig = {
  openai: {
    envKey: "OPENAI_API_KEY",
    defaultModel: "openai/gpt-5.5",
  },
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "anthropic/claude-opus-4-7",
  },
} as const;

export type AiProvider = keyof typeof aiProviderConfig;
