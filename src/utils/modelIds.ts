export const MODEL_ID_MAPPER: Record<string, string> = {
  "qwen2.5-7b": "qwen2.5:7b",
  "qwen2.5-14b": "qwen2.5:14b",
  "mistral-7b": "mistral:latest",
  "mistral": "mistral:latest",
  "llama3.2": "llama3.2:latest",
  "llama3": "llama3.2:latest",
  "llama2": "llama2:latest",
  "orca-mini": "orca-mini:latest",
  "phi": "phi:latest",
  "phi3": "phi3:latest",
  "phi4": "phi4:14b",
  "gemma": "gemma3:4b",
};

export const mapModelIdToOllamaName = (canonicalId: string): string => {
  const normalized = canonicalId.toLowerCase().trim();
  return MODEL_ID_MAPPER[normalized] || normalized;
};
