/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OLLAMA_BASE_URL: string;
  readonly VITE_TEXT_MODEL_ID: string;
  readonly VITE_IMAGE_MODEL_ID: string;
  readonly VITE_IMAGE_MODEL_ENDPOINT: string;
  readonly VITE_TTS_MODEL_ID: string;
  readonly VITE_TTS_ENDPOINT: string;
  readonly VITE_STT_MODEL_ID: string;
  readonly VITE_STT_ENDPOINT: string;
  readonly VITE_MODEL_API_KEY: string;
  readonly VITE_HF_BASE_URL: string;
  readonly HF_API_KEY: string;
  readonly API_KEY: string;
  readonly GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
