import { BlobLike } from "@/types/app";
import type {
  STTResponse,
  VoiceInfo,
  ImageGenerationOptions,
} from "@/types";

const env = import.meta.env;
const OLLAMA_BASE_URL = (
  env.VITE_OLLAMA_BASE_URL || "http://localhost:11434"
).trim();
const TEXT_MODEL_ID = (env.VITE_TEXT_MODEL_ID || "llama2").trim();
const IMAGE_MODEL_ID = (env.VITE_IMAGE_MODEL_ID || "").trim();
const IMAGE_ENDPOINT = (
  env.VITE_IMAGE_MODEL_ENDPOINT || "http://localhost:8000/api/image"
).trim();
const TTS_MODEL_ID = (env.VITE_TTS_MODEL_ID || "").trim();
const TTS_ENDPOINT = (env.VITE_TTS_ENDPOINT || "").trim();
const STT_MODEL_ID = (env.VITE_STT_MODEL_ID || "").trim();
const STT_ENDPOINT = (env.VITE_STT_ENDPOINT || "").trim();
const API_KEY = (
  env.VITE_MODEL_API_KEY ||
  env.HF_API_KEY ||
  env.API_KEY ||
  ""
).trim();

export const DEFAULT_TEXT_MODEL_ID = TEXT_MODEL_ID;

// Mapeador de IDs canónicos a nombres reales de Ollama
// Los IDs canónicos vienen del backend (hardware_profiles.py), pero los nombres
// reales de Ollama pueden ser diferentes (ej: qwen2.5-7b → qwen2.5:7b)
const MODEL_ID_MAPPER: Record<string, string> = {
  "qwen2.5-7b": "qwen2.5:7b",
  "qwen2.5-14b": "qwen2.5:14b",
  "mistral-7b": "mistral:latest",
  "mistral": "mistral:latest",
  "llama3.2": "llama3.2:latest",
  "llama3": "llama3.2:latest",
  "llama2": "llama2:latest",
  "orca-mini": "orca-mini:latest",
  "phi": "phi:latest",
  "gemma": "gemma3:4b",
};

/**
 * Mapea un ID canónico de modelo a su nombre real en Ollama
 * Si el modelo no tiene mapeo, lo devuelve tal cual
 */
export const mapModelIdToOllamaName = (canonicalId: string): string => {
  const normalized = canonicalId.toLowerCase().trim();
  return MODEL_ID_MAPPER[normalized] || normalized;
};

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

const ensureEndpoint = (value: string, message: string) => {
  if (!value) {
    throw new Error(message);
  }
  return value;
};

const jsonHeaders = () => ({
  "Content-Type": "application/json",
  ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
});

const audioHeaders = (mimeType?: string) => ({
  ...(mimeType ? { "Content-Type": mimeType } : {}),
  ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
});

export const callTextModel = async (
  prompt: string,
  modelId?: string
): Promise<string> => {
  const targetModelId = (modelId || TEXT_MODEL_ID).trim();

  ensureEndpoint(
    targetModelId,
    "Define VITE_TEXT_MODEL_ID en tu .env.local (ej: llama2, mistral, neural-chat)"
  );

  try {
    // Mapear ID canónico a nombre real de Ollama
    const ollamaModelName = mapModelIdToOllamaName(targetModelId);

    const response = await withTimeout(
      fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: ollamaModelName,
          prompt,
          stream: false,
          temperature: 0.4,
        }),
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error de Ollama (${response.status}): ${
          errorText || response.statusText
        }`
      );
    }

    const payload = await response.json();
    return payload?.response ?? JSON.stringify(payload);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
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
      .map((item: any) => item?.name)
      .filter((name: any): name is string => Boolean(name));
  } catch (e) {
    return [];
  }
};

export const callImageModel = async (
  options: ImageGenerationOptions
): Promise<string> => {
  const { prompt, negativePrompt, width, height, steps, base64Image } =
    options;

  const trimmedPrompt = prompt?.trim();
  if (!trimmedPrompt) {
    throw new Error("El prompt de la imagen no puede estar vacío");
  }

  const endpoint = ensureEndpoint(
    IMAGE_ENDPOINT,
    "Configura VITE_IMAGE_MODEL_ENDPOINT (por defecto FastAPI /api/image) o apunta a tu backend de imágenes"
  );

  try {
    const response = await withTimeout(
      fetch(endpoint, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: IMAGE_MODEL_ID || undefined,
          prompt: trimmedPrompt,
          negative_prompt: negativePrompt,
          width,
          height,
          num_inference_steps: steps || 4,
          image: base64Image,
        }),
      })
    );

    if (!response.ok) {
      const detail = await response.text();
      // Intentar limpiar el mensaje si viene como JSON de error
      let message = detail;
      try {
        const json = JSON.parse(detail);
        if (json.error) message = json.error;
      } catch (e) {}

      throw new Error(
        `Fallo en imagen (${response.status}): ${
          message || response.statusText
        }`
      );
    }

    const buffer = await response.arrayBuffer();
    return URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
  } catch (error) {
    // Si es un error de conexión (fetch failed), dar un mensaje más útil
    if (error instanceof Error && error.message.includes("fetch")) {
      throw new Error(
        `No se pudo conectar con el generador de imágenes en ${endpoint}. Asegúrate de que tu backend de imagen (python-backend/main.py) esté en ejecución.`
      );
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
};

export const callTextToSpeech = async (
  text: string,
  voicePreset: string,
  language?: string
): Promise<string> => {
  const endpoint = ensureEndpoint(
    TTS_ENDPOINT,
    "Define VITE_TTS_ENDPOINT para usar tu servicio local de TTS"
  );

  const response = await withTimeout(
    fetch(endpoint, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        model: TTS_MODEL_ID || undefined,
        inputs: text,
        language: language || undefined,
        voice_preset: voicePreset,
      }),
    })
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Fallo en TTS (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
};

export const callSpeechToText = async (
  audioBlob: Blob
): Promise<STTResponse> => {
  const endpoint = ensureEndpoint(
    STT_ENDPOINT,
    "Define VITE_STT_ENDPOINT para usar tu servicio local de STT"
  );

  const response = await withTimeout(
    fetch(endpoint, {
      method: "POST",
      headers: audioHeaders(audioBlob.type || "audio/wav"),
      body: audioBlob,
    })
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Fallo en STT (${response.status})`);
  }

  const payload = await response.json();
  return {
    text: payload?.text?.trim?.() ?? payload?.transcript?.trim?.() ?? "",
    language:
      payload?.language?.toLowerCase?.() ??
      payload?.detected_language?.toLowerCase?.() ??
      "",
    probability: Number(
      payload?.probability ?? payload?.confidence ?? 0
    ),
  };
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
      .map((voice: any): VoiceInfo | null => {
        if (typeof voice !== "object" || voice === null) return null;
        const id = String(voice.id || voice.voice || voice.name || "");
        if (!id) return null;
        const languages = Array.isArray(voice.languages)
          ? voice.languages
          : voice.language
          ? [voice.language]
          : [];

        return {
          id,
          name: String(voice.name || id),
          languages,
          language: languages[0]?.slice(0, 2),
          gender: voice.gender,
        };
      })
      .filter((voice): voice is VoiceInfo => Boolean(voice?.id));
  } catch (error) {
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
