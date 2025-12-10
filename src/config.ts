/**
 * src/config.ts
 *
 * Configuración centralizada de endpoints y URLs
 * Cambia automáticamente según el environment
 *
 * FASE 1.2 - Refactorización de Servicios
 */

const env = import.meta.env;

// ==========================================
// BACKEND - Unified Python FastAPI Backend
// ==========================================

export const API_BASE_URL = (
  env.VITE_API_BASE_URL || "http://localhost:8000"
).trim();

// ==========================================
// OLLAMA - Local LLM Backend
// ==========================================

export const OLLAMA_BASE_URL = (
  env.VITE_OLLAMA_BASE_URL || "http://localhost:11434"
).trim();

// ==========================================
// TEXT MODEL CONFIGURATION
// ==========================================

export const TEXT_MODEL_ID = (env.VITE_TEXT_MODEL_ID || "llama2").trim();

export const DEFAULT_TEXT_MODEL_ID = TEXT_MODEL_ID;

// ==========================================
// API TIMEOUT CONFIGURATION
// ==========================================

// 5 minutes for long-running tasks (image generation, etc.)
export const DEFAULT_TIMEOUT_MS = 300_000;

export const PROVIDER_LIMITS = {
  text: {
    maxTokens: Number(env.VITE_TEXT_MAX_TOKENS || "2048"),
    maxTemperature: Number(env.VITE_TEXT_MAX_TEMPERATURE || "1"),
  },
  image: {
    maxWidth: Number(env.VITE_IMAGE_MAX_WIDTH || "1536"),
    maxHeight: Number(env.VITE_IMAGE_MAX_HEIGHT || "1536"),
    maxSteps: Number(env.VITE_IMAGE_MAX_STEPS || "50"),
  },
  audio: {
    maxTtsChars: Number(env.VITE_TTS_MAX_CHARS || "2000"),
    maxSttDurationMs: Number(env.VITE_STT_MAX_DURATION_MS || "120000"),
  },
};

export const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: Number(env.VITE_PROVIDER_FAILURES || "3"),
  cooldownMs: Number(env.VITE_PROVIDER_COOLDOWN_MS || "60000"),
};

// ==========================================
// TTS / STT / IMAGE ENDPOINTS
// ==========================================

/**
 * TTS Endpoint - Genera audio desde texto (Kokoro-82M)
 * POST /api/tts con { inputs, language, voice_preset }
 */
export const TTS_ENDPOINT = `${API_BASE_URL}/api/tts`;

/**
 * STT Endpoint - Transcribe audio a texto (Faster-Whisper)
 * POST /api/stt con file upload
 */
export const STT_ENDPOINT = `${API_BASE_URL}/api/stt`;

/**
 * Image Generation Endpoint - Genera imágenes (SDXL Lightning)
 * POST /api/image con { prompt, negative_prompt, width, height, num_inference_steps }
 */
export const IMAGE_ENDPOINT = `${API_BASE_URL}/api/image`;

/**
 * Health Check Endpoint - Verifica estado del backend
 * GET /api/health
 */
export const HEALTH_CHECK_ENDPOINT = `${API_BASE_URL}/api/health`;

/**
 * System Capabilities Endpoint - Información de hardware
 * GET /api/system/capabilities
 */
export const CAPABILITIES_ENDPOINT = `${API_BASE_URL}/api/system/capabilities`;

// ==========================================
// VALIDATION UTILITIES
// ==========================================

/**
 * Valida que un endpoint esté configurado
 * Lanza error si el valor está vacío
 */
export const ensureEndpoint = (
  value: string,
  endpointName: string
): string => {
  if (!value || !value.trim()) {
    throw new Error(
      `${endpointName} no está configurado. Verifica .env.local o variables de entorno.`
    );
  }
  return value;
};

// ==========================================
// API KEY (si es necesario para APIs externas)
// ==========================================

export const API_KEY = (
  env.VITE_MODEL_API_KEY ||
  env.HF_API_KEY ||
  env.API_KEY ||
  ""
).trim();

// ==========================================
// FEATURE FLAGS (para futuros usos)
// ==========================================

export const FEATURE_FLAGS = {
  USE_BACKEND_TTS: true,
  USE_BACKEND_STT: true,
  USE_BACKEND_IMAGE: true,
  ENABLE_VOICE_CLONING: false, // Para cuando integremos XTTS v2
  DEBUG_MODE: env.VITE_DEBUG === "true",
};

export const PROVIDER_POLICIES = {
  allowCloudText: env.VITE_ALLOW_CLOUD_TEXT === "true",
  allowCloudImage: env.VITE_ALLOW_CLOUD_IMAGE === "true",
  allowCloudAudio: env.VITE_ALLOW_CLOUD_AUDIO === "true",
};

export const BENCHMARK_TTL_MS = Number(
  env.VITE_MODEL_BENCHMARK_TTL || 1000 * 60 * 60 * 24
);

// ==========================================
// LOGGING
// ==========================================

if (FEATURE_FLAGS.DEBUG_MODE) {
  console.log("🔧 Config loaded:", {
    API_BASE_URL,
    OLLAMA_BASE_URL,
    TEXT_MODEL_ID,
    TTS_ENDPOINT,
    STT_ENDPOINT,
    IMAGE_ENDPOINT,
  });
}
