import { BlobLike } from "@/types/app";
import type {
  STTResponse,
  VoiceInfo,
  ImageGenerationOptions,
} from "@/types";
import { modelProviderRegistry, TextGenerationRequest } from "@/services/modelProviders";

const env = import.meta.env;
const OLLAMA_BASE_URL = (
  env.VITE_OLLAMA_BASE_URL || "http://localhost:11434"
).trim();
const TEXT_MODEL_ID = (env.VITE_TEXT_MODEL_ID || "llama2").trim();
const IMAGE_MODEL_ID = (env.VITE_IMAGE_MODEL_ID || "").trim();
const API_KEY = (
  env.VITE_MODEL_API_KEY ||
  env.HF_API_KEY ||
  env.API_KEY ||
  ""
).trim();

export const DEFAULT_TEXT_MODEL_ID = TEXT_MODEL_ID;

const defaultTimeoutMs = 300_000;

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs = defaultTimeoutMs
) => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("El modelo tardó demasiado en responder (timeout)."));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
};

const jsonHeaders = () => ({
  "Content-Type": "application/json",
  ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
});

export const callTextModel = async (
  prompt: string,
  modelId?: string
): Promise<string> => {
  const request: TextGenerationRequest = {
    prompt,
    modelId: (modelId || TEXT_MODEL_ID).trim(),
  };
  return modelProviderRegistry.executeText(request, {
    preferredId: modelId ? "ollama-requested" : undefined,
  });
};


export const callImageModel = async (
  options: ImageGenerationOptions
): Promise<string> => {
  const trimmedPrompt = options.prompt?.trim();
  if (!trimmedPrompt) {
    throw new Error("El prompt de la imagen no puede estar vacío");
  }

  return modelProviderRegistry.executeImage({
    ...options,
    prompt: trimmedPrompt,
    model: options.model || IMAGE_MODEL_ID || undefined,
  });
};

export const callTextToSpeech = async (
  text: string,
  voicePreset: string,
  language?: string
): Promise<string> => {
  if (!text || !text.trim()) {
    throw new Error("El texto para TTS no puede estar vacío");
  }

  return modelProviderRegistry.executeTts({
    text,
    language,
    voicePreset,
  });
};


export const callSpeechToText = async (
  audioBlob: Blob
): Promise<STTResponse> => {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error("El audio para STT no puede estar vacío");
  }

  return modelProviderRegistry.executeStt({
    audio: audioBlob,
  });
};

export const listAvailableTextModels = async (): Promise<string[]> => {
  try {
    const response = await withTimeout(
      fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        method: "GET",
        headers: jsonHeaders(),
      }),
      15_000
    );

    if (!response.ok) return [];

    const payload = await response.json();
    const models = Array.isArray(payload?.models) ? payload.models : [];
    return models
      .map((item: Record<string, unknown>) => item?.name)
      .filter((name: unknown): name is string => Boolean(name));
  } catch {
    return [];
  }
};

export const fetchAvailableTtsVoices = async (
  baseEndpoint: string
): Promise<VoiceInfo[]> => {
  if (!baseEndpoint) return [];

  const trimmed = baseEndpoint.replace(/\/$/, "");
  const voicesEndpoint = trimmed.endsWith("/tts")
    ? `${trimmed.slice(0, -4)}/voices`
    : `${trimmed}/voices`;

  try {
    const response = await withTimeout(
      fetch(voicesEndpoint, {
        method: "GET",
        headers: jsonHeaders(),
      }),
      15_000
    );

    if (!response.ok) return [];

    const payload = await response.json();
    const voices = Array.isArray(payload?.voices)
      ? payload.voices
      : Array.isArray(payload)
      ? payload
      : [];

    return voices
      .map((voice: unknown): VoiceInfo | null => {
        if (typeof voice !== "object" || voice === null) return null;
        const voiceObj = voice as Record<string, unknown>;
        const id = String(voiceObj.id || voiceObj.voice || voiceObj.name || "");
        if (!id) return null;
        const languages = Array.isArray(voiceObj.languages)
          ? voiceObj.languages
          : voiceObj.language
          ? [voiceObj.language]
          : [];

        return {
          id,
          name: String(voiceObj.name || id),
          languages: languages as string[],
          language: (languages[0] as string)?.slice(0, 2),
          gender: voiceObj.gender as "male" | "female" | "neutral" | undefined,
        };
      })
      .filter((voice): voice is VoiceInfo => Boolean(voice?.id));
  } catch {
    return [];
  }
};

export const buildBlobLikeFromBase64 = (dataUrl: string): BlobLike => {
  const [header, data] = dataUrl.split(",");
  const mimeType = header?.match(/data:(.*);base64/)
    ? header.replace(/data:(.*);base64/, "$1")
    : "application/octet-stream";
  return { data, mimeType };
};
