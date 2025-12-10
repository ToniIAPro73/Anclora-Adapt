export type ModelTier = "local-premium" | "local-balanced" | "local-light" | "cloud";

const MODEL_TIER_MAP: Record<string, ModelTier> = {
  "phi4:14b": "local-premium",
  "deepseek-r1:8b": "local-premium",
  "qwen2.5:14b": "local-premium",
  "qwen2.5:7b": "local-balanced",
  "qwen2.5:7b-instruct": "local-balanced",
  "qwen2.5:7b-instruct-q4_k_m": "local-light",
  "mistral:latest": "local-balanced",
  "phi3:latest": "local-light",
  "phi3:3.8b-mini-128k-instruct-q4_k_m": "local-light",
  "llama3.2:latest": "local-light",
  "llama2:latest": "local-light",
  "gemma3:4b": "local-light",
  "gemma3:1b": "local-light",
  "llava:latest": "local-premium",
  "qwen3-vl:8b": "local-premium",
};

export const resolveModelTier = (modelId: string | null | undefined): ModelTier => {
  if (!modelId) return "local-balanced";
  const normalized = modelId.trim().toLowerCase();
  // heuristics for future cloud IDs
  if (/gpt|claude|openai|groq|gemini|sonnet/.test(normalized)) {
    return "cloud";
  }
  return MODEL_TIER_MAP[normalized] || "local-balanced";
};

export const describeTier = (tier: ModelTier, locale: "es" | "en") => {
  switch (tier) {
    case "local-premium":
      return locale === "es" ? "Local (alto rendimiento)" : "Local (high perf)";
    case "local-balanced":
      return locale === "es" ? "Local (balanceado)" : "Local (balanced)";
    case "local-light":
      return locale === "es" ? "Local (ligero)" : "Local (light)";
    case "cloud":
      return locale === "es" ? "Cloud" : "Cloud";
    default:
      return "Local";
  }
};
