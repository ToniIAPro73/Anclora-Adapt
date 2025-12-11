import { MODEL_BENCHMARKS } from "@/constants/modelBenchmarks";
import type {
  HardwareProfile,
  ModelPerformanceMetrics,
  ModelScoringRanking,
  ModelScoringResult,
  UserRequestContext,
} from "@/types/modelScoring";

const DEFAULT_METRICS: ModelPerformanceMetrics = {
  tokensPerSecond: 10,
  firstTokenLatencyMs: 1000,
  avgTokenLatencyMs: 40,
  vramRequiredGB: 4,
  contextWindowSize: 8192,
};

export class ModelScoringService {
  static scoreModels(
    context: UserRequestContext,
    hardware: HardwareProfile,
    availableModels: string[]
  ): ModelScoringRanking {
    const candidateSet = new Set(
      availableModels.filter(
        (model): model is string => Boolean(model && model !== "auto")
      )
    );
    if (!candidateSet.size) {
      Object.keys(MODEL_BENCHMARKS).forEach((model) =>
        candidateSet.add(model)
      );
    }

    const scored = Array.from(candidateSet)
      .map((modelName) => {
        const metrics = MODEL_BENCHMARKS[modelName] || DEFAULT_METRICS;
        return this.calculateScore(modelName, metrics, context, hardware);
      })
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      const fallback = this.calculateScore(
        availableModels[0] || "auto",
        DEFAULT_METRICS,
        context,
        hardware
      );
      return {
        primary: fallback,
        alternatives: [],
        fallbacks: [],
        allRanked: [fallback],
      };
    }

    return {
      primary: scored[0],
      alternatives: scored.slice(1, 3),
      fallbacks: scored.slice(3),
      allRanked: scored,
    };
  }

  private static calculateScore(
    modelName: string,
    metrics: ModelPerformanceMetrics,
    context: UserRequestContext,
    hardware: HardwareProfile
  ): ModelScoringResult {
    const qualityScore = this.calculateQualityScore(metrics, context);
    const speedScore = this.calculateSpeedScore(metrics, context);
    const vramScore = this.calculateVramEfficiency(metrics, hardware);
    const contextFitScore = this.calculateContextFit(metrics, context);
    const multilingualScore = this.calculateMultilingualSupport(metrics, context);

    let weights = {
      quality: 0.35,
      speed: 0.25,
      vram: 0.2,
      context: 0.15,
      multilingual: 0.05,
    };
    if (context.preferSpeed) {
      weights.speed = 0.35;
      weights.quality = 0.3;
    }
    if (context.preferQuality) {
      weights.quality = 0.45;
      weights.speed = 0.2;
    }

    const totalScore =
      qualityScore * weights.quality +
      speedScore * weights.speed +
      vramScore * weights.vram +
      contextFitScore * weights.context +
      multilingualScore * weights.multilingual;

    const roundedScore = Math.min(Math.round(totalScore), 100);
    const { tier, reason } = this.determineTierAndReason(
      modelName,
      roundedScore,
      context,
      metrics
    );

    const warnings: string[] = [];
    if (metrics.vramRequiredGB > hardware.gpuVramGB * 0.8) {
      warnings.push(
        `Modelo requiere ${metrics.vramRequiredGB} GB VRAM. Disponible: ${hardware.gpuVramGB} GB. Usa offloading si es necesario.`
      );
    }
    if (!context.deepThinking && metrics.vramRequiredGB + 4 > hardware.gpuVramGB) {
      warnings.push(
        "VRAM limitada para este modelo en tareas normales. Considera usar un modelo más ligero."
      );
    }

    return {
      modelName,
      score: roundedScore,
      scores: {
        quality: Math.min(Math.round(qualityScore), 100),
        speed: Math.min(Math.round(speedScore), 100),
        vramEfficiency: Math.min(Math.round(vramScore), 100),
        contextFit: Math.min(Math.round(contextFitScore), 100),
        multilingualSupport: Math.min(Math.round(multilingualScore), 100),
      },
      tier,
      reason,
      estimatedFirstTokenMs: metrics.firstTokenLatencyMs,
      estimatedVramUsageGB:
        Math.min(metrics.vramRequiredGB, hardware.gpuVramGB) + 1.5,
      warnings,
    };
  }

  private static calculateQualityScore(
    metrics: ModelPerformanceMetrics,
    context: UserRequestContext
  ): number {
    let baseScore = 0;
    if (context.mode === "basic") {
      baseScore = metrics.mmluScore || 0;
    } else if (context.mode === "intelligent") {
      const mmlu = metrics.mmluScore || 0;
      const math = metrics.mathScore || 0;
      baseScore = (mmlu + math) / 2;
      if (context.deepThinking) {
        baseScore = Math.min(baseScore * 1.05, 100);
      }
    } else if (context.mode === "vision") {
      baseScore = 80;
    } else {
      baseScore = metrics.mmluScore || 0;
    }

    if (
      context.tone === "professional" &&
      metrics.specializations?.includes("instruction-following")
    ) {
      baseScore *= 1.02;
    }
    return Math.min(baseScore, 100);
  }

  private static calculateSpeedScore(
    metrics: ModelPerformanceMetrics,
    context: UserRequestContext
  ): number {
    const maxTps = 90;
    const minTps = 1;
    let score =
      ((metrics.tokensPerSecond - minTps) / (maxTps - minTps)) * 100;
    score = Math.max(0, Math.min(100, score));
    if (context.preferSpeed) {
      score = Math.min(score * 1.1, 100);
    }
    if (context.maxChars && context.maxChars > 500 && metrics.tokensPerSecond < 20) {
      score *= 0.9;
    }
    return Math.min(score, 100);
  }

  private static calculateVramEfficiency(
    metrics: ModelPerformanceMetrics,
    hardware: HardwareProfile
  ): number {
    const required = metrics.vramRequiredGB;
    const available = hardware.gpuVramGB;
    if (required <= available) {
      const ratio = required / available;
      if (ratio >= 0.6 && ratio <= 0.8) {
        return 100;
      }
      if (ratio < 0.6) {
        return 85 + (ratio / 0.6) * 15;
      }
      return 90;
    }
    if (required <= available + hardware.ramGB / 2) {
      return 70;
    }
    return 0;
  }

  private static calculateContextFit(
    metrics: ModelPerformanceMetrics,
    context: UserRequestContext
  ): number {
    let score = 80;
    const requiredContextSize = (context.maxChars || 300) * 1.5;
    if (metrics.contextWindowSize < requiredContextSize) {
      score -= 20;
    }
    if (context.deepThinking && metrics.specializations?.includes("reasoning")) {
      score += 10;
    }
    if (
      context.mode === "basic" &&
      metrics.specializations?.includes("instruction-following")
    ) {
      score += 5;
    }
    return Math.min(Math.max(score, 0), 100);
  }

  private static calculateMultilingualSupport(
    metrics: ModelPerformanceMetrics,
    context: UserRequestContext
  ): number {
    if (context.language === "en") {
      return 100;
    }
    const supported = metrics.supportsLanguages || [];
    if (supported.includes(context.language)) {
      return 100;
    }
    const relatedLangs: Record<string, string[]> = {
      es: ["pt", "fr", "it"],
      zh: ["ja", "th"],
      hi: ["bn", "ur"],
    };
    if (
      relatedLangs[context.language]?.some((lang) => supported.includes(lang))
    ) {
      return 70;
    }
    return 40;
  }

  private static determineTierAndReason(
    modelName: string,
    score: number,
    context: UserRequestContext,
    metrics: ModelPerformanceMetrics
  ): { tier: "primary" | "alternative" | "fallback"; reason: string } {
    let tier: "primary" | "alternative" | "fallback";
    let reason = "";
    if (score >= 80) {
      tier = "primary";
      reason = `Excelente balance de ${
        context.preferSpeed ? "velocidad" : "calidad"
      } para este caso.`;
    } else if (score >= 70) {
      tier = "alternative";
      reason = `Alternativa viable con ${
        context.preferSpeed ? "calidad" : "velocidad"
      } como trade-off.`;
    } else {
      tier = "fallback";
      reason = "Opción de emergencia cuando los modelos principales no están disponibles.";
    }
    if (context.deepThinking && metrics.specializations?.includes("reasoning")) {
      reason = "Mejor soporte para pensamiento profundo y razonamiento complejo.";
    }
    if (
      context.language !== "en" &&
      metrics.supportsLanguages?.includes(context.language)
    ) {
      reason = `Soporte nativo para ${context.language.toUpperCase()}.`;
    }
    return { tier, reason };
  }
}
