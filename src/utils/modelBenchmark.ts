import { BENCHMARK_TTL_MS } from "@/config";
import { modelProviderRegistry } from "@/services/modelProviders";

export interface ModelBenchmarkResult {
  modelId: string;
  latencyMs: number;
  tokensPerSecond: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

type BenchmarkMap = Record<string, ModelBenchmarkResult>;

const STORAGE_KEY = "anclora-model-benchmarks";

const safeParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const loadBenchmarkMap = (): BenchmarkMap => {
  if (typeof window === "undefined") return {};
  return safeParse<BenchmarkMap>(localStorage.getItem(STORAGE_KEY), {});
};

export const persistBenchmarkResult = (result: ModelBenchmarkResult) => {
  if (typeof window === "undefined") return;
  const map = loadBenchmarkMap();
  map[result.modelId] = result;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

export const isBenchmarkFresh = (
  result: ModelBenchmarkResult,
  ttlMs: number = BENCHMARK_TTL_MS
) => {
  return Date.now() - result.timestamp < ttlMs;
};

const BENCH_PROMPT =
  "Eres un benchmark interno. Responde únicamente con la palabra OK para confirmar disponibilidad.";

export const benchmarkModel = async (
  modelId: string
): Promise<ModelBenchmarkResult> => {
  const start = performance.now();
  let success = true;
  let errorMessage: string | undefined;
  let responseText = "";

  try {
    responseText = await modelProviderRegistry.executeText(
      {
        prompt: BENCH_PROMPT,
        modelId,
        temperature: 0,
        timeoutMs: 20_000,
      },
      { preferredId: "ollama-requested", allowFallback: false }
    );
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const latencyMs = performance.now() - start;
  const tokenEstimate = Math.max(responseText.trim().length / 4, 1);
  const tokensPerSecond = success
    ? tokenEstimate / Math.max(latencyMs / 1000, 0.1)
    : 0;

  const result: ModelBenchmarkResult = {
    modelId,
    latencyMs,
    tokensPerSecond,
    timestamp: Date.now(),
    success,
    error: errorMessage,
  };
  return result;
};
