import {
  CIRCUIT_BREAKER_CONFIG,
  DEFAULT_TIMEOUT_MS,
  IMAGE_ENDPOINT,
  OLLAMA_BASE_URL,
  PROVIDER_LIMITS,
  STT_ENDPOINT,
  TTS_ENDPOINT,
  FEATURE_FLAGS,
  TEXT_MODEL_ID,
} from "@/config";
import { mapModelIdToOllamaName } from "@/utils/modelIds";
import type { ImageGenerationOptions, STTResponse } from "@/types";

type ProviderTier = "local" | "cloud-basic" | "cloud-premium";
type ProviderKind = "text" | "image" | "tts" | "stt";

interface CircuitState {
  failures: number;
  openedAt?: number;
}

interface ProviderTelemetry {
  id: string;
  kind: ProviderKind;
  durationMs: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

interface BaseProvider<Input, Output> {
  id: string;
  kind: ProviderKind;
  label: string;
  tier: ProviderTier;
  supports?: {
    languages?: string[];
    requiresModelId?: boolean;
  };
  isAvailable?: () => boolean | Promise<boolean>;
  invoke: (input: Input) => Promise<Output>;
}

interface ExecuteOptions {
  preferredId?: string;
  allowFallback?: boolean;
}

export interface TextGenerationRequest {
  prompt: string;
  modelId?: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface TtsRequest {
  text: string;
  language?: string;
  voicePreset: string;
}

export interface SttRequest {
  audio: Blob;
}

export type ImageRequest = ImageGenerationOptions;

const jsonHeaders = () => ({
  "Content-Type": "application/json",
});

const audioHeaders = (mimeType?: string) => ({
  ...(mimeType ? { "Content-Type": mimeType } : {}),
});

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("La solicitud excedi¢ el tiempo l¡mite."));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
};

class ModelProviderRegistry {
  private textProviders: BaseProvider<TextGenerationRequest, string>[] = [];
  private imageProviders: BaseProvider<ImageRequest, string>[] = [];
  private ttsProviders: BaseProvider<TtsRequest, string>[] = [];
  private sttProviders: BaseProvider<SttRequest, STTResponse>[] = [];
  private telemetry: ProviderTelemetry[] = [];
  private circuitState: Record<string, CircuitState> = {};

  registerTextProvider(provider: BaseProvider<TextGenerationRequest, string>) {
    this.textProviders.push(provider);
  }

  registerImageProvider(provider: BaseProvider<ImageRequest, string>) {
    this.imageProviders.push(provider);
  }

  registerTtsProvider(provider: BaseProvider<TtsRequest, string>) {
    this.ttsProviders.push(provider);
  }

  registerSttProvider(provider: BaseProvider<SttRequest, STTResponse>) {
    this.sttProviders.push(provider);
  }

  async executeText(
    request: TextGenerationRequest,
    options?: ExecuteOptions
  ): Promise<string> {
    return this.executeChain(this.textProviders, request, options);
  }

  async executeImage(
    request: ImageRequest,
    options?: ExecuteOptions
  ): Promise<string> {
    return this.executeChain(this.imageProviders, request, options);
  }

  async executeTts(
    request: TtsRequest,
    options?: ExecuteOptions
  ): Promise<string> {
    return this.executeChain(this.ttsProviders, request, options);
  }

  async executeStt(
    request: SttRequest,
    options?: ExecuteOptions
  ): Promise<STTResponse> {
    return this.executeChain(this.sttProviders, request, options);
  }

  getTelemetry(): ProviderTelemetry[] {
    return [...this.telemetry];
  }

  private sortProviders<T>(
    providers: BaseProvider<T, unknown>[],
    preferredId?: string
  ) {
    const priority = { local: 0, "cloud-basic": 1, "cloud-premium": 2 };
    const sorted = [...providers].sort(
      (a, b) => priority[a.tier] - priority[b.tier]
    );
    if (!preferredId) return sorted;

    const preferred = sorted.find((p) => p.id === preferredId);
    if (!preferred) return sorted;

    return [preferred, ...sorted.filter((p) => p.id !== preferredId)];
  }

  private isCircuitOpen(providerId: string) {
    const state = this.circuitState[providerId];
    if (!state) return false;
    if (
      state.failures < CIRCUIT_BREAKER_CONFIG.failureThreshold ||
      !state.openedAt
    ) {
      return false;
    }
    const elapsed = Date.now() - state.openedAt;
    if (elapsed > CIRCUIT_BREAKER_CONFIG.cooldownMs) {
      this.circuitState[providerId] = { failures: 0 };
      return false;
    }
    return true;
  }

  private registerFailure(providerId: string) {
    const state = this.circuitState[providerId] || { failures: 0 };
    state.failures += 1;
    if (
      state.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold &&
      !state.openedAt
    ) {
      state.openedAt = Date.now();
    }
    this.circuitState[providerId] = state;
  }

  private registerSuccess(providerId: string) {
    this.circuitState[providerId] = { failures: 0 };
  }

  private recordTelemetry(entry: ProviderTelemetry) {
    this.telemetry.push(entry);
    if (this.telemetry.length > 30) {
      this.telemetry.shift();
    }
  }

  private async executeChain<Input, Output>(
    providers: BaseProvider<Input, Output>[],
    request: Input,
    options?: ExecuteOptions
  ): Promise<Output> {
    const ordered = this.sortProviders(providers, options?.preferredId);
    let lastError: Error | null = null;

    for (const provider of ordered) {
      if (this.isCircuitOpen(provider.id)) {
        continue;
      }

      const availability = provider.isAvailable
        ? await Promise.resolve(provider.isAvailable())
        : true;

      if (!availability) {
        continue;
      }

      const start = performance.now();
      try {
        const result = await provider.invoke(request);
        const durationMs = performance.now() - start;
        this.registerSuccess(provider.id);
        this.recordTelemetry({
          id: provider.id,
          kind: provider.kind,
          durationMs,
          success: true,
          timestamp: Date.now(),
        });
        return result;
      } catch (error) {
        const durationMs = performance.now() - start;
        const errInstance = error instanceof Error ? error : new Error(String(error));
        lastError = errInstance;
        this.registerFailure(provider.id);
        this.recordTelemetry({
          id: provider.id,
          kind: provider.kind,
          durationMs,
          success: false,
          error: errInstance.message,
          timestamp: Date.now(),
        });
        if (FEATURE_FLAGS.DEBUG_MODE) {
          console.warn(
            `[ModelProvider] ${provider.id} fall¢:`,
            errInstance.message
          );
        }
        if (!options?.allowFallback) {
          break;
        }
      }
    }

    throw (
      lastError ||
      new Error("No hay proveedores disponibles para esta operaci¢n.")
    );
  }
}

export const modelProviderRegistry = new ModelProviderRegistry();

const callOllama = async (
  prompt: string,
  modelId: string,
  temperature = 0.4,
  timeoutMs?: number
): Promise<string> => {
  const response = await withTimeout(
    fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        model: mapModelIdToOllamaName(modelId),
        prompt,
        stream: false,
        temperature,
      }),
    }),
    timeoutMs
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Error Ollama (${response.status})`);
  }

  const payload = await response.json();
  return payload?.response ?? JSON.stringify(payload);
};

const callFastApiImage = async (
  options: ImageGenerationOptions
): Promise<string> => {
  const response = await withTimeout(
    fetch(IMAGE_ENDPOINT, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        model: options.model || undefined,
        prompt: options.prompt,
        negative_prompt: options.negativePrompt,
        width: Math.min(options.width ?? 1024, PROVIDER_LIMITS.image.maxWidth),
        height: Math.min(
          options.height ?? 1024,
          PROVIDER_LIMITS.image.maxHeight
        ),
        num_inference_steps: Math.min(
          options.steps ?? 4,
          PROVIDER_LIMITS.image.maxSteps
        ),
        image: options.base64Image,
      }),
    })
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Error Imagen (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
};

const callBackendTts = async (request: TtsRequest): Promise<string> => {
  const payload = {
    model: "kokoro",
    inputs: request.text,
    language: request.language || "es",
    voice_preset: request.voicePreset,
  };

  const response = await withTimeout(
    fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    }),
    DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Error TTS (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
};

const callBackendStt = async (request: SttRequest): Promise<STTResponse> => {
  const response = await withTimeout(
    fetch(STT_ENDPOINT, {
      method: "POST",
      headers: audioHeaders(request.audio.type || "audio/wav"),
      body: request.audio,
    }),
    DEFAULT_TIMEOUT_MS
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Error STT (${response.status})`);
  }

  const payload = await response.json();
  return {
    text: payload?.text?.trim?.() ?? payload?.transcript?.trim?.() ?? "",
    language:
      payload?.language?.toLowerCase?.() ??
      payload?.detected_language?.toLowerCase?.() ??
      "",
    probability: Number(payload?.probability ?? payload?.confidence ?? 0),
  };
};

// ------------------------------------------
// Default providers
// ------------------------------------------

modelProviderRegistry.registerTextProvider({
  id: "ollama-requested",
  kind: "text",
  label: "Ollama (Modelo solicitado)",
  tier: "local",
  invoke: async (request) => {
    if (!request.modelId) {
      throw new Error("No se proporcion¢ modelId para el proveedor solicitado.");
    }
    return callOllama(
      request.prompt,
      request.modelId,
      request.temperature,
      request.timeoutMs
    );
  },
});

modelProviderRegistry.registerTextProvider({
  id: "ollama-default",
  kind: "text",
  label: "Ollama (Fallback)",
  tier: "local",
  invoke: async (request) =>
    callOllama(
      request.prompt,
      request.modelId || TEXT_MODEL_ID,
      request.temperature,
      request.timeoutMs
    ),
});

modelProviderRegistry.registerImageProvider({
  id: "fastapi-sdxl",
  kind: "image",
  label: "Backend SDXL Lightning",
  tier: "local",
  invoke: callFastApiImage,
});

modelProviderRegistry.registerTtsProvider({
  id: "fastapi-tts",
  kind: "tts",
  label: "Backend Kokoro TTS",
  tier: "local",
  invoke: callBackendTts,
});

modelProviderRegistry.registerSttProvider({
  id: "fastapi-stt",
  kind: "stt",
  label: "Backend Faster-Whisper",
  tier: "local",
  invoke: callBackendStt,
});
