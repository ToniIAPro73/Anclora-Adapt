/**
 * src/services/api.ts
 *
 * Servicio API centralizado que comunica con el backend Python FastAPI
 * Proporciona métodos para:
 * - Text generation (Ollama)
 * - TTS (Kokoro-82M)
 * - STT (Faster-Whisper)
 * - Image generation (SDXL Lightning)
 *
 * FASE 1.2 - Refactorización de Servicios
 */

import {
  API_BASE_URL,
  OLLAMA_BASE_URL,
  TEXT_MODEL_ID,
  TTS_ENDPOINT,
  STT_ENDPOINT,
  IMAGE_ENDPOINT,
  HEALTH_CHECK_ENDPOINT,
  CAPABILITIES_ENDPOINT,
  DEFAULT_TIMEOUT_MS,
  ensureEndpoint,
  FEATURE_FLAGS,
} from "@/config";
import type {
  HealthCheckResponse,
  SystemCapabilities,
  TTSRequest,
  STTResponse,
  ImageRequest,
} from "@/types";

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Envuelve una Promise con un timeout
 * @param promise - Promise a envolver
 * @param timeoutMs - Tiempo de espera máximo en milisegundos
 * @throws Error si se excede el timeout
 */
const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("La solicitud tardó demasiado en responder (timeout)."));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
};

/**
 * Convierte un File a base64
 */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const commaIndex = result.indexOf(",");
        resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
      } else {
        reject(new Error("No se pudo leer el archivo."));
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error("Error al leer el archivo."));
    };
    reader.readAsDataURL(file);
  });

// ==========================================
// API SERVICE CLASS
// ==========================================

class ApiService {
  /**
   * Verifica la salud del backend
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const endpoint = ensureEndpoint(
      HEALTH_CHECK_ENDPOINT,
      "Health check endpoint"
    );

    const response = await withTimeout(
      fetch(endpoint, { method: "GET" }),
      5000
    );

    if (!response.ok) {
      throw new Error(
        `Backend health check falló: ${response.statusText}. ¿Está el servidor FastAPI corriendo en ${API_BASE_URL}?`
      );
    }

    return response.json();
  }

  /**
   * Obtiene capacidades del hardware del backend
   */
  async getCapabilities(): Promise<SystemCapabilities> {
    const endpoint = ensureEndpoint(
      CAPABILITIES_ENDPOINT,
      "Capabilities endpoint"
    );

    const response = await withTimeout(
      fetch(endpoint, { method: "GET" }),
      5000
    );

    if (!response.ok) {
      throw new Error(
        `No se pudieron obtener capacidades del sistema: ${response.statusText}`
      );
    }

    return response.json();
  }

  // ==========================================
  // TEXT GENERATION (Ollama)
  // ==========================================

  /**
   * Genera texto usando Ollama (llama2, mistral, etc.)
   * Este método sigue usando Ollama local, no el backend Python
   */
  async generateText(prompt: string, modelId?: string): Promise<string> {
    if (!TEXT_MODEL_ID && !modelId) {
      throw new Error(
        "Define VITE_TEXT_MODEL_ID en tu .env.local o pasa modelId como parámetro"
      );
    }

    const actualModelId = modelId || TEXT_MODEL_ID;

    const response = await withTimeout(
      fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: actualModelId,
          prompt: prompt,
          stream: false,
          temperature: 0.4,
        }),
      })
    );

    if (!response.ok) {
      throw new Error(
        `Error Ollama: ${response.statusText}. ¿Está Ollama ejecutándose en ${OLLAMA_BASE_URL}?`
      );
    }

    const payload = await response.json();
    return payload?.response ?? JSON.stringify(payload);
  }

  // ==========================================
  // TTS (Text-to-Speech) - Kokoro-82M
  // ==========================================

  /**
   * Genera audio desde texto usando Kokoro-82M
   * @param text - Texto a convertir a voz
   * @param language - Código de idioma (default: "es")
   * @param voicePreset - Preset de voz (default: "af_sarah")
   * @returns Blob de audio WAV
   */
  async generateTTS(
    text: string,
    language: string = "es",
    voicePreset: string = "af_sarah"
  ): Promise<Blob> {
    if (!FEATURE_FLAGS.USE_BACKEND_TTS) {
      throw new Error("TTS está deshabilitado en las feature flags");
    }

    ensureEndpoint(TTS_ENDPOINT, "TTS endpoint");

    if (!text || text.trim().length === 0) {
      throw new Error("El texto para TTS no puede estar vacío");
    }

    if (text.length > 2000) {
      throw new Error(
        "El texto para TTS es demasiado largo (máximo 2000 caracteres)"
      );
    }

    if (FEATURE_FLAGS.DEBUG_MODE) {
      console.log(`🎤 TTS Request: "${text.substring(0, 50)}..." (${language}, voz: ${voicePreset})`);
    }

    const request: TTSRequest = {
      inputs: text,
      language: language,
      voice_preset: voicePreset,
      model: "kokoro",
    };

    const response = await withTimeout(
      fetch(TTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }),
      10000 // TTS puede tardar un poco
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error TTS: ${response.statusText} - ${errorText}`);
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error("El servidor TTS devolvió un archivo vacío");
    }

    if (FEATURE_FLAGS.DEBUG_MODE) {
      console.log(`✓ TTS Response: ${blob.size} bytes, tipo: ${blob.type}`);
    }

    return blob;
  }

  // ==========================================
  // STT (Speech-to-Text) - Faster-Whisper
  // ==========================================

  /**
   * Transcribe audio a texto usando Faster-Whisper Large-v3-Turbo
   * @param audioBlob - Blob de audio para transcribir
   * @returns Objeto con texto transcrito, idioma detectado y probabilidad
   */
  async transcribeAudio(audioBlob: Blob): Promise<STTResponse> {
    if (!FEATURE_FLAGS.USE_BACKEND_STT) {
      throw new Error("STT está deshabilitado en las feature flags");
    }

    ensureEndpoint(STT_ENDPOINT, "STT endpoint");

    if (audioBlob.size === 0) {
      throw new Error("El archivo de audio no puede estar vacío");
    }

    if (FEATURE_FLAGS.DEBUG_MODE) {
      console.log(`👂 STT Request: ${audioBlob.size} bytes, tipo: ${audioBlob.type}`);
    }

    const formData = new FormData();
    formData.append("file", audioBlob);

    const response = await withTimeout(
      fetch(STT_ENDPOINT, {
        method: "POST",
        body: formData,
        // NO incluir Content-Type: application/json
        // FormData se envía con boundary automáticamente
      }),
      30000 // STT puede tardar más
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error STT: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();

    if (FEATURE_FLAGS.DEBUG_MODE) {
      console.log(`✓ STT Response: "${result.text}" (${result.language}, prob: ${result.probability})`);
    }

    return result;
  }

  // ==========================================
  // IMAGE GENERATION - SDXL Lightning
  // ==========================================

  /**
   * Genera una imagen a partir de un prompt usando SDXL Lightning
   * @param prompt - Descripción de la imagen
   * @param negativePrompt - Descripción de lo que NO quieres (default: "")
   * @param width - Ancho en píxeles (default: 1024)
   * @param height - Alto en píxeles (default: 1024)
   * @param steps - Pasos de inferencia (default: 4 para SDXL Lightning)
   * @returns Blob de imagen PNG
   */
  async generateImage(
    prompt: string,
    negativePrompt: string = "",
    width: number = 1024,
    height: number = 1024,
    steps: number = 4
  ): Promise<Blob> {
    if (!FEATURE_FLAGS.USE_BACKEND_IMAGE) {
      throw new Error("Generación de imágenes está deshabilitada en las feature flags");
    }

    ensureEndpoint(IMAGE_ENDPOINT, "Image endpoint");

    if (!prompt || prompt.trim().length === 0) {
      throw new Error("El prompt para la imagen no puede estar vacío");
    }

    if (FEATURE_FLAGS.DEBUG_MODE) {
      console.log(`🎨 Image Request: "${prompt.substring(0, 50)}..." (${width}x${height}, ${steps} steps)`);
    }

    const request: ImageRequest = {
      prompt: prompt,
      negative_prompt: negativePrompt,
      width: width,
      height: height,
      num_inference_steps: steps,
    };

    const response = await withTimeout(
      fetch(IMAGE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }),
      60000 // Las imágenes pueden tardar
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error Imagen: ${response.statusText} - ${errorText}`);
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error("El servidor devolvió una imagen vacía");
    }

    if (FEATURE_FLAGS.DEBUG_MODE) {
      console.log(`✓ Image Response: ${blob.size} bytes, tipo: ${blob.type}`);
    }

    return blob;
  }
}

// ==========================================
// SINGLETON EXPORT
// ==========================================

/**
 * Instancia única del servicio API
 * Úsalo en todo el frontend así:
 *
 * import { apiService } from '@/services/api'
 * const audioBlob = await apiService.generateTTS("Hola mundo")
 */
export const apiService = new ApiService();

// También exporte la clase para testing
export type { ApiService };
