// Shared by client and server. Base URLs are fixed here on purpose; users can't enter their own.
export type ProviderId = "opencode-go" | "opencode-zen" | "xai" | "openrouter";

export type Provider = {
  id: ProviderId;
  name: string;
  baseUrl: string;
  defaultModel: string;
  keyPrefix: string;
  keyUrl: string;
};

export const PROVIDERS: Provider[] = [
  {
    id: "opencode-go",
    name: "OpenCode Go",
    baseUrl: "https://opencode.ai/zen/go/v1",
    defaultModel: "deepseek-v4.1-flash",
    keyPrefix: "oc_sk_",
    keyUrl: "https://opencode.ai/console",
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    defaultModel: "glm-5.3-flash",
    keyPrefix: "oc_sk_",
    keyUrl: "https://opencode.ai/console",
  },
  {
    id: "xai",
    name: "xAI",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4",
    keyPrefix: "xai-",
    keyUrl: "https://console.x.ai",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/auto",
    keyPrefix: "sk-or-",
    keyUrl: "https://openrouter.ai/keys",
  },
];

// Best guess from the key's prefix; OpenCode keys default to Go.
export function guessProvider(key: string): ProviderId | undefined {
  return PROVIDERS.find((p) => key.trim().startsWith(p.keyPrefix))?.id;
}
