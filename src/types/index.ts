/**
 * src/types/index.ts
 *
 * Tipos centralizados compartidos por toda la aplicación
 * Extraído de App.tsx durante la refactorización FASE 1.1
 */

// ==========================================
// THEME & LANGUAGE TYPES
// ==========================================

export type ThemeMode = "light" | "dark" | "system";
export type InterfaceLanguage = "es" | "en";

// ==========================================
// OUTPUT & CONTENT TYPES
// ==========================================

export interface BlobLike {
  data: string;
  mimeType: string;
}

export interface GeneratedOutput {
  platform: string;
  content: string;
}

// ==========================================
// MODEL & API TYPES
// ==========================================

export type AutoModelContext = {
  mode?: string;
  preferSpeed?: boolean;
  preferReasoning?: boolean;
  preferChat?: boolean;
};

export const AUTO_TEXT_MODEL_ID = "auto";

// ==========================================
// TTS / STT / IMAGE REQUEST TYPES
// ==========================================

export interface TTSRequest {
  inputs: string;
  model?: string;
  language?: string;
  voice_preset?: string;
}

export interface TTSResponse {
  /**
   * Audio blob response from /api/tts
   * Returns audio/wav stream directly
   */
  // The response is a Blob, not JSON
}

export interface STTRequest {
  file: Blob;
}

export interface STTResponse {
  text: string;
  language: string;
  probability: number;
}

export interface ImageRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
}

export interface ImageResponse {
  /**
   * Image blob response from /api/image
   * Returns image/png stream directly
   */
  // The response is a Blob, not JSON
}

// ==========================================
// HARDWARE / SYSTEM TYPES
// ==========================================

export interface HardwareInfo {
  cpu_cores: number;
  ram_gb: number;
  gpu_model: string;
  gpu_vram_gb: number;
  device: "cuda" | "cpu";
}

export interface HealthCheckResponse {
  status: string;
  hardware: HardwareInfo;
}

export interface SystemCapabilities extends HardwareInfo {
  can_use_tts: boolean;
  can_use_stt: boolean;
  can_use_image: boolean;
}

// ==========================================
// INTERACTION STATE TYPES
// ==========================================

export type AppMode =
  | "basic"
  | "smart"
  | "campaign"
  | "recycle"
  | "chat"
  | "voice"
  | "livechat"
  | "image";

export interface InteractionContextType {
  // Mode & Theme
  activeMode: AppMode;
  setActiveMode: (mode: AppMode) => void;

  // Input & Output
  currentInput: string;
  setCurrentInput: (input: string) => void;
  outputs: GeneratedOutput[];
  addOutput: (output: GeneratedOutput) => void;
  clearOutputs: () => void;

  // Loading & Error States
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Model Selection
  selectedModel: string;
  setSelectedModel: (model: string) => void;

  // Media (for image/voice modes)
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  audioBlob: Blob | null;
  setAudioBlob: (blob: Blob | null) => void;
}

export interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  isDarkMode: boolean;
}

export interface LanguageContextType {
  language: InterfaceLanguage;
  setLanguage: (lang: InterfaceLanguage) => void;
}

// ==========================================
// UTILITY TYPES
// ==========================================

export interface ParsedEnvConfig {
  OLLAMA_BASE_URL: string;
  API_BASE_URL: string;
  TEXT_MODEL_ID: string;
  IMAGE_ENDPOINT: string;
  TTS_ENDPOINT: string;
  STT_ENDPOINT: string;
  API_KEY: string;
}

// ==========================================
// VOICE PRESET TYPES
// ==========================================

export interface VoiceInfo {
  id: string;
  name: string;
  language: string;
  gender?: "male" | "female" | "neutral";
}

export interface Voice {
  id: string;
  name: string;
}
