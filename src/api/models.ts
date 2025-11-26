import { BlobLike } from "@/types/app";

const env = import.meta.env;
const OLLAMA_BASE_URL = (
  env.VITE_OLLAMA_BASE_URL || "http://localhost:11434"
).trim();
const TEXT_MODEL_ID = (env.VITE_TEXT_MODEL_ID || "llama2").trim();
const IMAGE_MODEL_ID = (env.VITE_IMAGE_MODEL_ID || "").trim();
const IMAGE_ENDPOINT = (
  env.VITE_IMAGE_MODEL_ENDPOINT || "http://localhost:9090/image"
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
    const response = await withTimeout(
      fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: targetModelId,
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
  prompt: string,
  base64Image?: string
): Promise<string> => {
  const endpoint = ensureEndpoint(
    IMAGE_ENDPOINT,
    "Configura VITE_IMAGE_MODEL_ENDPOINT o ejecuta `npm run image:bridge` para un backend local de imagen"
  );

  try {
    const response = await withTimeout(
      fetch(endpoint, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: IMAGE_MODEL_ID || undefined,
          prompt,
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
        `No se pudo conectar con el generador de imágenes en ${endpoint}. Asegúrate de ejecutar 'npm run image:bridge'.`
      );
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
};

export const callTextToSpeech = async (
  text: string,
  voicePreset: string
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
        parameters: { voice_preset: voicePreset },
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

export const callSpeechToText = async (audioBlob: Blob): Promise<string> => {
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
  return payload?.text?.trim?.() ?? payload?.transcript ?? "";
};

export const buildBlobLikeFromBase64 = (dataUrl: string): BlobLike => {
  const [header, data] = dataUrl.split(",");
  const mimeType = header?.match(/data:(.*);base64/)
    ? header.replace(/data:(.*);base64/, "$1")
    : "application/octet-stream";
  return { data, mimeType };
};
