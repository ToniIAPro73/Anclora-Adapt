# Anclora Adapt: Implementación Técnica del Sistema de Scoring
## Guía de Integración en TypeScript/React

**Versión:** 1.0  
**Fecha:** Diciembre 11, 2025  
**Stack:** TypeScript + React 19 + Ollama API

---

## 1. Estructura de Datos

```typescript
// src/types/modelScoring.ts

export interface ModelPerformanceMetrics {
  // Benchmarks de calidad
  mmluScore?: number;      // 0-100 (MMLU benchmark)
  humanEvalScore?: number; // 0-100 (HumanEval)
  mathScore?: number;      // 0-100 (MATH benchmark)
  
  // Rendimiento
  tokensPerSecond: number;
  firstTokenLatencyMs: number;
  avgTokenLatencyMs: number;
  
  // Hardware
  vramRequiredGB: number;
  ramUsageGB: number;
  
  // Capacidades
  contextWindowSize: number;
  supportsLanguages: string[]; // ['en', 'es', 'fr']
  specializations: string[]; // ['code', 'math', 'reasoning']
}

export interface UserRequestContext {
  // Modo
  mode: 'basic' | 'intelligent' | 'vision' | 'chat' | 'tts' | 'stt' | 'live' | 'image';
  
  // Parámetros de entrada
  language: string;
  platforms?: string[];
  tone?: 'professional' | 'casual' | 'formal' | 'friendly';
  
  // Flags de operación
  improvePrompt: boolean;
  deepThinking: boolean;
  includeImage?: boolean;
  
  // Restricciones
  minChars?: number;
  maxChars?: number;
  
  // Preferencias del usuario
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
  score: number; // 0-100
  
  // Desglose de scores
  scores: {
    quality: number;
    speed: number;
    vramEfficiency: number;
    contextFit: number;
    multilingualSupport?: number;
  };
  
  // Recomendación
  tier: 'primary' | 'alternative' | 'fallback';
  reason: string;
  
  // Info operativa
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
```

---

## 2. Datos de Benchmarks

```typescript
// src/constants/modelBenchmarks.ts

export const MODEL_BENCHMARKS = {
  'qwen2.5:7b-instruct': {
    mmluScore: 86.1,
    humanEvalScore: 79.8,
    mathScore: 83.1,
    tokensPerSecond: 22,
    firstTokenLatencyMs: 1400,
    avgTokenLatencyMs: 45,
    vramRequiredGB: 4.7,
    contextWindowSize: 128000,
    supportsLanguages: ['en', 'es', 'fr', 'zh', 'ja', 'de', 'it', 'pt', 'ar', 'ru'],
    specializations: ['general', 'instruction-following', 'reasoning'],
    qualityRating: 'excellent',
  },
  
  'mistral:latest': {
    mmluScore: 83.7,
    humanEvalScore: 78.2,
    mathScore: 79.5,
    tokensPerSecond: 25,
    firstTokenLatencyMs: 1200,
    avgTokenLatencyMs: 40,
    vramRequiredGB: 4.4,
    contextWindowSize: 32000,
    supportsLanguages: ['en', 'es', 'fr', 'de', 'it', 'nl', 'pt', 'sv'],
    specializations: ['general', 'instruction-following', 'function-calling'],
    qualityRating: 'very-good',
  },
  
  'llama3.2:latest': {
    mmluScore: 85.2,
    humanEvalScore: 80.5,
    mathScore: 81.0,
    tokensPerSecond: 20,
    firstTokenLatencyMs: 1300,
    avgTokenLatencyMs: 50,
    vramRequiredGB: 2.0,
    contextWindowSize: 131072,
    supportsLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'th', 'ar'],
    specializations: ['general', 'reasoning', 'coding'],
    qualityRating: 'very-good',
  },
  
  'gemma3:4b': {
    mmluScore: 77.8,
    humanEvalScore: 71.2,
    mathScore: 72.5,
    tokensPerSecond: 88,
    firstTokenLatencyMs: 800,
    avgTokenLatencyMs: 11.4,
    vramRequiredGB: 3.3,
    contextWindowSize: 8192,
    supportsLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt'],
    specializations: ['general', 'instruction-following'],
    qualityRating: 'good',
  },
  
  'phi3:3.8b-mini-128k-instruct-q4_K_M': {
    mmluScore: 75.3,
    humanEvalScore: 68.0,
    mathScore: 70.2,
    tokensPerSecond: 90,
    firstTokenLatencyMs: 750,
    avgTokenLatencyMs: 11.1,
    vramRequiredGB: 2.4,
    contextWindowSize: 131072,
    supportsLanguages: ['en'],
    specializations: ['instruction-following', 'lightweight'],
    qualityRating: 'good',
  },
  
  'qwen2.5:14b': {
    mmluScore: 87.3,
    humanEvalScore: 82.5,
    mathScore: 85.2,
    tokensPerSecond: 12,
    firstTokenLatencyMs: 2200,
    avgTokenLatencyMs: 83.3,
    vramRequiredGB: 9.0,
    contextWindowSize: 128000,
    supportsLanguages: ['en', 'es', 'fr', 'zh', 'ja', 'de', 'it', 'pt', 'ar', 'ru', 'hi'],
    specializations: ['reasoning', 'code', 'math', 'instruction-following'],
    qualityRating: 'excellent',
  },
  
  'deepseek-r1:8b': {
    mmluScore: 84.5,
    humanEvalScore: 79.2,
    mathScore: 84.0,
    tokensPerSecond: 18,
    firstTokenLatencyMs: 1500,
    avgTokenLatencyMs: 55.6,
    vramRequiredGB: 5.2,
    contextWindowSize: 64000,
    supportsLanguages: ['en', 'zh', 'es'],
    specializations: ['reasoning', 'math', 'coding'],
    qualityRating: 'very-good',
  },
};

// Benchmarks de Visión
export const VISION_MODEL_BENCHMARKS = {
  'qwen3-vl:8b': {
    mmmuScore: 72,
    docvqaScore: 96,
    vqav2Score: 85,
    tokensPerSecond: 18,
    firstTokenLatencyMs: 1800,
    avgTokenLatencyMs: 55,
    vramRequiredGB: 6.1,
    contextWindowSize: 128000,
    maxImageResolution: 1536,
    supportsLanguages: ['en', 'es', 'zh', 'ja', 'ar'],
    specializations: ['ocr', 'visual-reasoning', 'detail-extraction'],
    qualityRating: 'excellent',
  },
  
  'llava:latest': {
    mmmuScore: 68,
    docvqaScore: 90,
    vqav2Score: 82,
    tokensPerSecond: 12,
    firstTokenLatencyMs: 2000,
    avgTokenLatencyMs: 83,
    vramRequiredGB: 4.7,
    contextWindowSize: 4096,
    maxImageResolution: 1024,
    supportsLanguages: ['en'],
    specializations: ['image-captioning', 'visual-qa'],
    qualityRating: 'good',
  },
};

// Benchmarks de STT
export const STT_MODEL_BENCHMARKS = {
  'whisper-large-v3': {
    werScore: 7.4,
    supportsLanguages: 99,
    realTimeFactorApprox: 0.5,
    vramRequiredGB: 10,
    contextWindowMs: 30000,
    qualityRating: 'excellent',
  },
  
  'whisper-large-v3-turbo': {
    werScore: 7.75,
    supportsLanguages: 99,
    realTimeFactorApprox: 0.1,
    vramRequiredGB: 6,
    contextWindowMs: 30000,
    qualityRating: 'very-good',
  },
  
  'distil-whisper': {
    werScore: 7.8,
    supportsLanguages: 1,
    realTimeFactorApprox: 0.08,
    vramRequiredGB: 5,
    contextWindowMs: 30000,
    qualityRating: 'very-good',
  },
};

// Benchmarks de TTS
export const TTS_MODEL_BENCHMARKS = {
  'kokoro-82m': {
    latencyMs: 300,
    qualityRating: 6.5,
    naturalness: 'synthetic',
    vramRequiredGB: 0.3,
    supportsLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'zh'],
    voiceCount: 54,
  },
  
  'piper-tts': {
    latencyMs: 2500,
    qualityRating: 8.0,
    naturalness: 'neutral-professional',
    vramRequiredGB: 0.5,
    supportsLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'uk', 'zh', 'ja'],
    voiceCount: 150,
  },
  
  'f5-tts': {
    latencyMs: 7000,
    qualityRating: 9.0,
    naturalness: 'natural-expressive',
    vramRequiredGB: 2.0,
    supportsLanguages: ['en', 'es', 'fr', 'zh'],
    voiceCount: 20,
  },
};
```

---

## 3. Servicio de Scoring

```typescript
// src/services/modelScoringService.ts

import { MODEL_BENCHMARKS, VISION_MODEL_BENCHMARKS } from '@/constants/modelBenchmarks';
import type {
  ModelPerformanceMetrics,
  UserRequestContext,
  HardwareProfile,
  ModelScoringResult,
  ModelScoringRanking,
} from '@/types/modelScoring';

export class ModelScoringService {
  /**
   * Selecciona el ranking de modelos para una solicitud del usuario
   */
  static scoreModels(
    context: UserRequestContext,
    hardware: HardwareProfile,
    availableModels: string[]
  ): ModelScoringRanking {
    const scored = availableModels
      .map(modelName => {
        const metrics = MODEL_BENCHMARKS[modelName as keyof typeof MODEL_BENCHMARKS];
        if (!metrics) return null;

        return this.calculateScore(modelName, metrics, context, hardware);
      })
      .filter(Boolean) as ModelScoringResult[];

    // Ordenar por score descendent
    const sorted = scored.sort((a, b) => b.score - a.score);

    return {
      primary: sorted[0],
      alternatives: sorted.slice(1, 3),
      fallbacks: sorted.slice(3),
      allRanked: sorted,
    };
  }

  /**
   * Calcula el score total para un modelo en un contexto específico
   */
  private static calculateScore(
    modelName: string,
    metrics: ModelPerformanceMetrics,
    context: UserRequestContext,
    hardware: HardwareProfile
  ): ModelScoringResult {
    // 1. Calcular componentes de score
    const qualityScore = this.calculateQualityScore(metrics, context);
    const speedScore = this.calculateSpeedScore(metrics, context);
    const vramScore = this.calculateVramEfficiency(metrics, hardware);
    const contextFitScore = this.calculateContextFit(metrics, context);
    const multilingualScore = this.calculateMultilingualSupport(metrics, context);

    // 2. Aplicar pesos dinámicos basado en preferencias
    let weights = {
      quality: 0.35,
      speed: 0.25,
      vram: 0.20,
      context: 0.15,
      multilingual: 0.05,
    };

    if (context.preferSpeed) {
      weights.speed = 0.35;
      weights.quality = 0.30;
    }
    if (context.preferQuality) {
      weights.quality = 0.45;
      weights.speed = 0.20;
    }

    // 3. Calcular score total ponderado
    const totalScore =
      qualityScore * weights.quality +
      speedScore * weights.speed +
      vramScore * weights.vram +
      contextFitScore * weights.context +
      multilingualScore * weights.multilingual;

    // 4. Determinar tier y reason
    const { tier, reason } = this.determineTierAndReason(
      modelName,
      totalScore,
      context,
      metrics
    );

    // 5. Calcular warnings
    const warnings: string[] = [];
    if (metrics.vramRequiredGB > hardware.gpuVramGB * 0.8) {
      warnings.push(
        `Modelo requiere ${metrics.vramRequiredGB}GB VRAM. Disponible: ${hardware.gpuVramGB}GB. Usa offloading a CPU.`
      );
    }
    if (metrics.vramRequiredGB + 4 > hardware.gpuVramGB && !context.deepThinking) {
      warnings.push('VRAM limitada. Considera un modelo más pequeño.');
    }

    return {
      modelName,
      score: Math.round(totalScore),
      scores: {
        quality: Math.round(qualityScore),
        speed: Math.round(speedScore),
        vramEfficiency: Math.round(vramScore),
        contextFit: Math.round(contextFitScore),
        multilingualSupport: Math.round(multilingualScore),
      },
      tier,
      reason,
      estimatedFirstTokenMs: metrics.firstTokenLatencyMs,
      estimatedVramUsageGB: Math.min(metrics.vramRequiredGB, hardware.gpuVramGB) + 1.5,
      warnings,
    };
  }

  /**
   * Calcula score de calidad (35% del total)
   */
  private static calculateQualityScore(
    metrics: ModelPerformanceMetrics,
    context: UserRequestContext
  ): number {
    let baseScore = 0;

    if (context.mode === 'basic') {
      // Para modo básico, MMLU es el mejor indicador
      baseScore = metrics.mmluScore || 0;
    } else if (context.mode === 'intelligent') {
      // Para modo inteligente, promediamos MMLU + MATH (reasoning)
      const mmlu = metrics.mmluScore || 0;
      const math = metrics.mathScore || 0;
      baseScore = (mmlu + math) / 2;

      // Bonus si deep thinking está habilitado
      if (context.deepThinking) {
        baseScore *= 1.05;
      }
    } else if (context.mode === 'vision') {
      // Para visión, necesitamos metrics de visión (manejar en otro método)
      baseScore = 80;
    }

    // Ajustar por especialización si es relevante
    if (context.tone === 'professional' && metrics.specializations?.includes('instruction-following')) {
      baseScore *= 1.02;
    }

    return Math.min(baseScore, 100);
  }

  /**
   * Calcula score de velocidad (25% del total)
   */
  private static calculateSpeedScore(
    metrics: ModelPerformanceMetrics,
    context: UserRequestContext
  ): number {
    // Baseline: tokens/segundo
    // 90+ T/s = 100 puntos
    // 10 T/s = 50 puntos
    // <1 T/s = 0 puntos

    const maxTps = 90;
    const minTps = 1;
    let speedScore = ((metrics.tokensPerSecond - minTps) / (maxTps - minTps)) * 100;
    speedScore = Math.max(0, Math.min(100, speedScore));

    // Bonus si el usuario prefiere velocidad
    if (context.preferSpeed) {
      speedScore *= 1.1;
    }

    // Penalty si max chars es muy alto y velocidad es baja
    if (context.maxChars && context.maxChars > 500 && metrics.tokensPerSecond < 20) {
      speedScore *= 0.9;
    }

    return Math.min(speedScore, 100);
  }

  /**
   * Calcula eficiencia VRAM (20% del total)
   */
  private static calculateVramEfficiency(
    metrics: ModelPerformanceMetrics,
    hardware: HardwareProfile
  ): number {
    const vramRequired = metrics.vramRequiredGB;
    const vramAvailable = hardware.gpuVramGB;

    // Si cabe completamente en GPU
    if (vramRequired <= vramAvailable) {
      const utilizationRatio = vramRequired / vramAvailable;
      // Ideal: 60-80% utilización
      if (utilizationRatio >= 0.6 && utilizationRatio <= 0.8) {
        return 100;
      } else if (utilizationRatio < 0.6) {
        return 85 + (utilizationRatio / 0.6) * 15; // 85-100
      } else {
        return 90; // 80-90% es aceptable
      }
    }

    // Si requiere offloading a RAM
    if (vramRequired <= vramAvailable + hardware.ramGB / 2) {
      return 70; // Viable pero con penalidad
    }

    // No cabe ni con offloading
    return 0;
  }

  /**
   * Calcula fit de contexto (15% del total)
   */
  private static calculateContextFit(
    metrics: ModelPerformanceMetrics,
    context: UserRequestContext
  ): number {
    let score = 80; // Base

    // Verificar window size
    const requiredContextSize = (context.maxChars || 300) * 1.5; // Aproximación de tokens
    if (metrics.contextWindowSize < requiredContextSize) {
      score -= 20;
    }

    // Specializations match
    if (context.deepThinking && metrics.specializations?.includes('reasoning')) {
      score += 10;
    }
    if (context.mode === 'basic' && metrics.specializations?.includes('instruction-following')) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  /**
   * Calcula soporte multilingüe (5% del total)
   */
  private static calculateMultilingualSupport(
    metrics: ModelPerformanceMetrics,
    context: UserRequestContext
  ): number {
    if (context.language === 'en') {
      return 100; // Todos soportan inglés
    }

    const supportedLangs = metrics.supportsLanguages || [];
    if (supportedLangs.includes(context.language)) {
      return 100;
    }

    // Parcialmente soportado (ej: lenguajes relacionados)
    const relatedLangs: Record<string, string[]> = {
      es: ['pt', 'fr', 'it'],
      zh: ['ja', 'th'],
      hi: ['bn', 'ur'],
    };

    if (relatedLangs[context.language]?.some(l => supportedLangs.includes(l))) {
      return 70;
    }

    return 40; // No soportado, pero puede intentar
  }

  /**
   * Determina tier de recomendación y razón
   */
  private static determineTierAndReason(
    modelName: string,
    score: number,
    context: UserRequestContext,
    metrics: ModelPerformanceMetrics
  ): { tier: 'primary' | 'alternative' | 'fallback'; reason: string } {
    let tier: 'primary' | 'alternative' | 'fallback';
    let reason = '';

    if (score >= 80) {
      tier = 'primary';
      reason = `Excelente balance de ${context.preferSpeed ? 'velocidad' : 'calidad'} para este caso`;
    } else if (score >= 70) {
      tier = 'alternative';
      reason = `Alternativa viable con trade-offs de ${context.preferSpeed ? 'calidad' : 'velocidad'}`;
    } else {
      tier = 'fallback';
      reason = `Opción de emergencia solo si otros modelos no disponibles`;
    }

    // Personalizar razón específica
    if (context.deepThinking && metrics.specializations?.includes('reasoning')) {
      reason = `Mejor soporte para pensamiento profundo y razonamiento complejo`;
    }
    if (context.language !== 'en' && metrics.supportsLanguages?.includes(context.language)) {
      reason = `Soporte nativo para ${context.language}`;
    }

    return { tier, reason };
  }
}
```

---

## 4. Hook React para Scoring

```typescript
// src/hooks/useModelScoring.ts

import { useCallback, useMemo } from 'react';
import { ModelScoringService } from '@/services/modelScoringService';
import type {
  UserRequestContext,
  HardwareProfile,
  ModelScoringRanking,
} from '@/types/modelScoring';

export function useModelScoring(
  hardware: HardwareProfile,
  availableModels: string[]
) {
  const scoreModelsCallback = useCallback(
    (context: UserRequestContext): ModelScoringRanking => {
      return ModelScoringService.scoreModels(context, hardware, availableModels);
    },
    [hardware, availableModels]
  );

  return { scoreModels: scoreModelsCallback };
}
```

---

## 5. Integración en BasicMode.tsx

```typescript
// En src/components/modes/BasicMode.tsx

import { useModelScoring } from '@/hooks/useModelScoring';
import { useLayoutState } from '@/context/useContextSelectors';

// Dentro del componente BasicMode
const BasicMode: FC<BasicModeProps> = ({ ... }) => {
  const { activeMode, hardwareProfile } = useLayoutState();
  const { scoreModels } = useModelScoring(hardwareProfile, availableModelsFromOllama);

  const handleGenerate = async () => {
    // ... validaciones existentes ...

    // 1. Crear contexto de solicitud
    const requestContext: UserRequestContext = {
      mode: 'basic',
      language,
      platforms: literalTranslation ? [language] : platforms,
      tone: tone as any,
      improvePrompt,
      deepThinking: false, // Basic mode no usa deep thinking
      minChars: minCharLimit,
      maxChars: maxCharLimit,
      preferSpeed: speed === 'flash',
      preferQuality: speed === 'detailed',
    };

    // 2. Obtener ranking de modelos
    const ranking = scoreModels(requestContext);

    // 3. Usar modelo recomendado
    const selectedModel = ranking.primary.modelName;
    console.log(`[Model Scoring] Seleccionado: ${selectedModel} (score: ${ranking.primary.score})`);

    if (ranking.primary.warnings.length > 0) {
      setError(`⚠️ ${ranking.primary.warnings[0]}`);
    }

    // 4. Pasar modelo seleccionado al contexto de generación
    await onGenerate(prompt, {
      mode: 'basic',
      selectedModel, // ← NUEVO
      preferSpeed: speed === 'flash',
      preferReasoning: false,
      targetLanguage: language,
      allowedPlatforms: requestContext.platforms,
      minChars: minCharLimit,
      maxChars: maxCharLimit,
      isLiteralTranslation: literalTranslation,
      numberOfPlatforms: literalTranslation ? 1 : platforms.length,
      tone: tone,
      improvePrompt,
    });
  };

  // Mostrar info de scoring en UI (opcional)
  const [selectedRanking, setSelectedRanking] = useState<ModelScoringRanking | null>(null);

  return (
    // ... JSX existente ...
    {selectedRanking && (
      <div style={{ ...commonStyles.debugPanel }}>
        <h4>Modelos Recomendados:</h4>
        <p><strong>1. {selectedRanking.primary.modelName}</strong> - Score: {selectedRanking.primary.score}</p>
        <p>Razón: {selectedRanking.primary.reason}</p>
        {selectedRanking.alternatives.map((alt, i) => (
          <p key={i}>{i + 2}. {alt.modelName} - Score: {alt.score}</p>
        ))}
      </div>
    )}
  );
};
```

---

## 6. Integración en App.tsx

```typescript
// En src/App.tsx, en la función onGenerate

const onGenerate = async (
  prompt: string,
  context?: AutoModelContext
) => {
  try {
    setIsLoading(true);
    
    // El contexto ahora incluye selectedModel si viene del scoring
    const modelToUse = context?.selectedModel || textModelId;
    
    console.log(`[Generation] Usando modelo: ${modelToUse}`);
    
    const response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelToUse,
        prompt,
        stream: false,
      }),
    });

    // ... resto del flujo ...
  } catch (error) {
    // ... manejo de errores ...
  } finally {
    setIsLoading(false);
  }
};
```

---

## 7. Testing del Sistema

```typescript
// src/__tests__/modelScoring.test.ts

import { ModelScoringService } from '@/services/modelScoringService';
import type { UserRequestContext, HardwareProfile } from '@/types/modelScoring';

describe('ModelScoringService', () => {
  const hardware: HardwareProfile = {
    gpuVramGB: 4,
    ramGB: 31.5,
    cpuCores: 6,
    gpuModel: 'RTX 3050',
    isLaptop: true,
  };

  const availableModels = [
    'qwen2.5:7b-instruct',
    'mistral:latest',
    'llama3.2:latest',
    'gemma3:4b',
  ];

  it('debería seleccionar qwen2.5:7b para contenido profesional', () => {
    const context: UserRequestContext = {
      mode: 'basic',
      language: 'en',
      platforms: ['linkedin'],
      tone: 'professional',
      improvePrompt: true,
      deepThinking: false,
      maxChars: 300,
      preferSpeed: false,
      preferQuality: true,
    };

    const ranking = ModelScoringService.scoreModels(context, hardware, availableModels);

    expect(ranking.primary.modelName).toBe('qwen2.5:7b-instruct');
    expect(ranking.primary.score).toBeGreaterThan(80);
  });

  it('debería seleccionar gemma3:4b para respuestas rápidas', () => {
    const context: UserRequestContext = {
      mode: 'basic',
      language: 'es',
      platforms: ['twitter', 'instagram'],
      tone: 'casual',
      improvePrompt: false,
      deepThinking: false,
      maxChars: 150,
      preferSpeed: true,
      preferQuality: false,
    };

    const ranking = ModelScoringService.scoreModels(context, hardware, availableModels);

    expect(ranking.primary.modelName).toBe('gemma3:4b');
    expect(ranking.primary.scores.speed).toBeGreaterThan(85);
  });

  it('debería avisar sobre VRAM para qwen2.5:14b', () => {
    const context: UserRequestContext = {
      mode: 'intelligent',
      language: 'en',
      deepThinking: true,
      improvePrompt: true,
      preferSpeed: false,
      preferQuality: true,
    };

    const ranking = ModelScoringService.scoreModels(
      context,
      hardware,
      ['qwen2.5:14b']
    );

    expect(ranking.primary.warnings.length).toBeGreaterThan(0);
    expect(ranking.primary.warnings[0]).toContain('offloading');
  });
});
```

---

## Conclusión

Este sistema proporciona:

✅ **Selección Automática** de modelos basada en benchmarks reales  
✅ **Adaptación Dinámica** al hardware disponible  
✅ **Scoring Transparente** con desglose de factores  
✅ **Advertencias Inteligentes** sobre limitaciones  
✅ **Fallbacks Automáticos** en caso de falta de recursos  

El código es modular, testeable y fácil de mantener para futuras optimizaciones.
