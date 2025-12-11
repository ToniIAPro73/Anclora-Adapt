export type ModelScoringMode =
  | "basic"
  | "intelligent"
  | "campaign"
  | "recycle"
  | "chat"
  | "tts"
  | "live"
  | "vision"
  | "image"
  | "stt";

export interface ModelPerformanceMetrics {
  mmluScore?: number;
  humanEvalScore?: number;
  mathScore?: number;
  tokensPerSecond: number;
  firstTokenLatencyMs: number;
  avgTokenLatencyMs: number;
  vramRequiredGB: number;
  ramUsageGB?: number;
  contextWindowSize: number;
  supportsLanguages?: string[];
  specializations?: string[];
  qualityRating?: string;
}

export interface UserRequestContext {
  mode: ModelScoringMode;
  language: string;
  platforms: string[];
  tone?: string;
  improvePrompt?: boolean;
  deepThinking?: boolean;
  includeImage?: boolean;
  minChars?: number;
  maxChars?: number;
  preferSpeed: boolean;
  preferQuality: boolean;
}

export interface HardwareProfile {
  gpuVramGB: number;
  ramGB: number;
  cpuCores: number;
  gpuModel: string;
  isLaptop: boolean;
}

export interface ModelScoringResult {
  modelName: string;
  score: number;
  scores: {
    quality: number;
    speed: number;
    vramEfficiency: number;
    contextFit: number;
    multilingualSupport: number;
  };
  tier: "primary" | "alternative" | "fallback";
  reason: string;
  estimatedFirstTokenMs: number;
  estimatedVramUsageGB: number;
  warnings: string[];
}

export interface ModelScoringRanking {
  primary: ModelScoringResult;
  alternatives: ModelScoringResult[];
  fallbacks: ModelScoringResult[];
  allRanked: ModelScoringResult[];
}
