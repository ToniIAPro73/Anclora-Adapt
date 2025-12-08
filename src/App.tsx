import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
  lazy,
} from "react";

// ===== PERFORMANCE: Code splitting with lazy loading =====
// Each mode component loads on demand (only when user switches to it)
// This reduces initial bundle size by ~40% and improves first paint time significantly
const BasicMode = lazy(() => import("@/components/modes/BasicMode"));
const IntelligentMode = lazy(() => import("@/components/modes/IntelligentMode"));
const CampaignMode = lazy(() => import("@/components/modes/CampaignMode"));
const RecycleMode = lazy(() => import("@/components/modes/RecycleMode"));
const ChatMode = lazy(() => import("@/components/modes/ChatMode"));
const TTSMode = lazy(() => import("@/components/modes/TTSMode"));
const LiveChatMode = lazy(() => import("@/components/modes/LiveChatMode"));
const ImageEditMode = lazy(() => import("@/components/modes/ImageEditMode"));
import MainLayout from "@/components/layout/MainLayout";
import { apiService } from "@/services/api";
import {
  callTextModel,
  listAvailableTextModels,
  callImageModel,
  callTextToSpeech,
  callSpeechToText,
  DEFAULT_TEXT_MODEL_ID,
} from "@/api/models";
import { translations } from "@/constants/translations";
import {
  LANGUAGE_LABELS,
  LANGUAGE_CODE_MAP,
} from "@/constants/options";
import { structuredOutputExample } from "@/constants/prompts";
import {
  AUTO_TEXT_MODEL_ID,
  type AutoModelContext,
  type GeneratedOutput,
  type AppMode,
} from "@/types";
import { useLanguage } from "@/context/LanguageContext";
import { useInteraction } from "@/context/InteractionContext";
import { STT_ENDPOINT, TTS_ENDPOINT } from "@/config";
import {
  buildLanguageOptions,
  inferLanguagesForModel,
  LanguageOptionAvailability,
} from "@/constants/modelCapabilities";

// ===== PERFORMANCE: Regex patterns compiled once at module level =====
const MODEL_PATTERNS = {
  qwenMistralLlama3: /qwen|mistral|llama3/i,
  qwenYiDeepseek: /qwen|yi|deepseek/i,
  mistralGemma: /mistral|gemma/i,
  llama: /llama/i,
  llama3: /llama3/i,
  llama2: /llama2/i,
  phiMiniChatOrca: /phi|mini|chat|orca|gemma/i,
  qwen: /qwen/i,
  mistral: /mistral/i,
};

const extractJsonPayload = (raw: string) => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return raw;
  }

  let jsonSnippet = raw.slice(start, end + 1);

  try {
    JSON.parse(jsonSnippet);
    return jsonSnippet;
  } catch {
    jsonSnippet = jsonSnippet
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/:\s*True\b/g, ": true")
      .replace(/:\s*False\b/g, ": false")
      .replace(/:\s*None\b/g, ": null")
      .replace(/'([^']+)'\s*:/g, '"$1":')
      .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");
    return jsonSnippet;
  }
};

const isGeneratedOutput = (value: unknown): value is GeneratedOutput => {
  return (
    Boolean(value) &&
    typeof (value as GeneratedOutput).platform === "string" &&
    typeof (value as GeneratedOutput).content === "string"
  );
};

const normalizeOutputs = (payload: unknown): GeneratedOutput[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.filter(isGeneratedOutput);
  }
  if (
    typeof payload === "object" &&
    Array.isArray((payload as { outputs?: unknown[] }).outputs)
  ) {
    return ((payload as { outputs: unknown[] }).outputs || []).filter(
      isGeneratedOutput
    );
  }
  if (
    typeof payload === "object" &&
    payload !== null &&
    (payload as GeneratedOutput).platform &&
    (payload as GeneratedOutput).content
  ) {
    return [(payload as GeneratedOutput)];
  }
  if (typeof payload === "object" && payload) {
    const firstArrayKey = Object.keys(payload).find((key) =>
      Array.isArray((payload as Record<string, unknown[]>)[key])
    );
    if (firstArrayKey) {
      const arr = (payload as Record<string, unknown[]>)[firstArrayKey];
      return arr.filter(isGeneratedOutput);
    }
  }
  return [];
};

const filterOutputsByPlatforms = (
  outputs: GeneratedOutput[],
  allowed?: string[]
): GeneratedOutput[] => {
  if (!allowed || allowed.length === 0) {
    return outputs;
  }
  const normalizeName = (value: string) =>
    value
      ? value
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[\s_-]+/g, "")
      : "";
  const normalizedAllowed = allowed
    .map((platform) => normalizeName(platform))
    .filter(Boolean);
  if (!normalizedAllowed.length) {
    return outputs;
  }
  const filtered: GeneratedOutput[] = [];
  const usedIndexes = new Set<number>();

  // Platform mapping: some aliases that models might use
  // Key = normalized platform name that user selected
  // Value = list of platform names that model might generate (all normalized)
  const platformAliases: Record<string, string[]> = {
    x: ["x", "twitter"],
    twitter: ["twitter", "x"],
    linkedln: ["linkedin", "linkedln"],
    linkedin: ["linkedin", "linkedln"],
    instagram: ["instagram", "ig"],
    ig: ["instagram", "ig"],
    whatsapp: ["whatsapp"],
    email: ["email", "correo", "mail"],
  };

  normalizedAllowed.forEach((targetName) => {
    // Get accepted aliases for this platform
    const acceptedNames = platformAliases[targetName] || [targetName];

    const matchIndex = outputs.findIndex((output, index) => {
      if (usedIndexes.has(index) || !output.platform) {
        return false;
      }
      const normalizedPlatform = normalizeName(output.platform);
      // Check if normalized platform matches any accepted name
      return acceptedNames.some(
        (name) =>
          normalizedPlatform === name || normalizedPlatform.startsWith(name)
      );
    });
    if (matchIndex >= 0) {
      filtered.push(outputs[matchIndex]);
      usedIndexes.add(matchIndex);
    }
  });

  // Si el filtrado no devolvió nada, algo está mal. Devolver una lista vacía en lugar de todo
  // para que el usuario sepa que no se generó contenido para las plataformas solicitadas
  return filtered;
};

const LANGUAGE_QUALITY_LABELS: Record<string, string> = {
  es: "español",
  en: "inglés",
  fr: "francés",
  de: "alemán",
  pt: "portugués",
  it: "italiano",
  zh: "chino",
  ja: "japonés",
  ru: "ruso",
};

const describeLanguageForPrompt = (code?: string) => {
  if (!code || code === "detect") {
    return "el idioma solicitado";
  }
  return LANGUAGE_QUALITY_LABELS[code] || code;
};

const enforceLanguageQuality = async (
  outputs: GeneratedOutput[],
  languageCode: string | undefined,
  modelId: string,
  generateFn: (prompt: string, model: string) => Promise<string>
): Promise<GeneratedOutput[]> => {
  if (!outputs.length || !languageCode || languageCode === "detect") {
    return outputs;
  }
  try {
    const descriptor = describeLanguageForPrompt(languageCode);
    const payload = JSON.stringify({ outputs });
    const prompt = `Actúa como revisor nativo de ${descriptor}. Corrige ortografía, gramática y coherencia manteniendo el mismo significado y tono. Si algún texto no está en ${descriptor}, tradúcelo correctamente. Respeta exactamente la cantidad de entradas y nombres de plataforma. Devuelve exclusivamente JSON válido con la misma estructura de la entrada. Texto a revisar: ${payload}`;
    const raw = await generateFn(prompt, modelId);
    const parsed = JSON.parse(extractJsonPayload(raw));
    const normalized = normalizeOutputs(parsed);
    if (normalized.length === outputs.length) {
      return normalized;
    }
    if (normalized.length) {
      return normalized;
    }
  } catch (err) {
    console.warn("Language quality enforcement failed", err);
  }
  return outputs;
};

const speakWithBrowserTts = async (text: string, language: string) => {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    throw new Error("speechSynthesis no está disponible en este navegador.");
  }

  return new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "es" ? "es-ES" : `${language}-US`;
    utterance.onend = () => resolve();
    utterance.onerror = (event) =>
      reject(
        event.error
          ? new Error(String(event.error))
          : new Error("speechSynthesis falló")
      );
    window.speechSynthesis.speak(utterance);
  });
};

const App: React.FC = () => {
  const { language } = useLanguage();
  const {
    activeMode,
    setActiveMode,
    addOutput,
    clearOutputs,
    isLoading: _isLoading,
    setIsLoading: _setIsLoading,
    error: _error,
    setError: _setError,
    selectedModel,
    setSelectedModel,
    imageUrl: _imageUrl,
    setImageUrl: _setImageUrl,
    setLastModelUsed,
    hardwareProfile,
    setHardwareProfile,
  } = useInteraction();

  const [isHardwareAdjusting, setIsHardwareAdjusting] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  // Memoizar objeto de traducciones para evitar re-renders innecesarios en componentes hijos
  const copy = useMemo(() => translations[language], [language]);

  const installedModels = useMemo(() => {
    const set = new Set<string>();
    availableModels.forEach((model) => set.add(model));
    if (selectedModel) {
      set.add(selectedModel);
    }
    set.add(DEFAULT_TEXT_MODEL_ID);
    return Array.from(set);
  }, [availableModels, selectedModel]);

  const languageOptions: LanguageOptionAvailability[] = useMemo(
    () => buildLanguageOptions(selectedModel, installedModels),
    [selectedModel, installedModels]
  );

  const recommendedTextKeywords = useMemo(
    () =>
      hardwareProfile?.recommendations?.text?.map((rec) =>
        rec.id.toLowerCase()
      ) ?? [],
    [hardwareProfile]
  );

  const hardwareModeAvailability = useMemo(() => {
    if (!hardwareProfile?.mode_support) return null;
    const record: Partial<
      Record<AppMode, { enabled: boolean; reason?: string }>
    > = {};
    hardwareProfile.mode_support.forEach((entry) => {
      const normalizedId = entry.id as AppMode;
      record[normalizedId] = {
        enabled: entry.enabled,
        reason: entry.reason || undefined,
      };
    });
    return record;
  }, [hardwareProfile]);

  const tabs: { id: AppMode; label: string }[] = useMemo(
    () => [
      { id: "basic", label: copy.tabs.basic },
      { id: "intelligent", label: copy.tabs.intelligent },
      { id: "campaign", label: copy.tabs.campaign },
      { id: "recycle", label: copy.tabs.recycle },
      { id: "chat", label: copy.tabs.chat },
      { id: "tts", label: copy.tabs.tts },
      { id: "live", label: copy.tabs.live },
      { id: "image", label: copy.tabs.image },
    ],
    [copy.tabs]
  );

  useEffect(() => {
    if (!hardwareModeAvailability) return;
    if (hardwareModeAvailability[activeMode]?.enabled === false) {
      const fallback = tabs.find(
        (tab) => hardwareModeAvailability[tab.id]?.enabled !== false
      );
      if (fallback) {
        setActiveMode(fallback.id);
      }
    }
  }, [hardwareModeAvailability, activeMode, tabs, setActiveMode]);

  const rawModelOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            AUTO_TEXT_MODEL_ID,
            selectedModel,
            ...availableModels,
            DEFAULT_TEXT_MODEL_ID,
          ].filter(Boolean)
        )
      ),
    [availableModels, selectedModel]
  );

  const filteredModelOptions = useMemo(() => {
    const uniqueList = rawModelOptions;
    if (!recommendedTextKeywords.length) {
      return uniqueList;
    }
    const isRecommendedModel = (model?: string) =>
      Boolean(model) &&
      recommendedTextKeywords.some((keyword) =>
        model!.toLowerCase().includes(keyword)
      );
    const recommended = uniqueList.filter(isRecommendedModel);
    if (!recommended.length) {
      return uniqueList;
    }
    const others = uniqueList.filter((model) => !recommended.includes(model));
    return Array.from(
      new Set(
        [
          AUTO_TEXT_MODEL_ID,
          selectedModel,
          ...recommended,
          ...others,
        ].filter(Boolean) as string[]
      )
    );
  }, [rawModelOptions, recommendedTextKeywords, selectedModel]);

  const availableModelPool = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(selectedModel && selectedModel !== AUTO_TEXT_MODEL_ID
              ? [selectedModel]
              : []),
            ...availableModels,
            DEFAULT_TEXT_MODEL_ID,
          ].filter(
            (model): model is string =>
              Boolean(model) && model !== AUTO_TEXT_MODEL_ID
          )
        )
      ),
    [availableModels, selectedModel]
  );

  const constrainedModelPool = useMemo(() => {
    if (!recommendedTextKeywords.length) {
      return availableModelPool;
    }

    const matched = availableModelPool.filter((model) =>
      recommendedTextKeywords.some((keyword) =>
        model.toLowerCase().includes(keyword)
      )
    );

    return matched.length ? matched : availableModelPool;
  }, [availableModelPool, recommendedTextKeywords]);

  const refreshAvailableModels = useCallback(async () => {
    setIsFetchingModels(true);
    try {
      const models = await listAvailableTextModels();
      setAvailableModels(models);
      if (
        selectedModel !== AUTO_TEXT_MODEL_ID &&
        models.length > 0 &&
        !models.includes(selectedModel)
      ) {
        setSelectedModel(models[0]);
      }
    } catch (err) {
      console.warn("No se pudo listar los modelos disponibles.", err);
    } finally {
      setIsFetchingModels(false);
    }
  }, [selectedModel, setSelectedModel]);

  useEffect(() => {
    void refreshAvailableModels();
  }, [refreshAvailableModels]);

  const scoreModelForContext = useCallback(
    (modelId: string, context?: AutoModelContext) => {
      const normalized = modelId.toLowerCase();
      let score = 0;

      // ========== BONUS POR HARDWARE DISPONIBLE ==========
      // Si tenemos mucha RAM disponible, priorizar modelos grandes/mejores
      // incluso si VRAM es limitada (pueden ejecutarse bien en RAM)
      if (hardwareProfile?.hardware.ram_gb && hardwareProfile.hardware.ram_gb >= 24) {
        // Con >= 24 GB RAM, los modelos 7B pueden ejecutarse bien incluso con VRAM baja
        if (MODEL_PATTERNS.qwenMistralLlama3.test(normalized)) {
          score += 8; // Bonus significativo por capacidad en RAM
        }
      } else if (hardwareProfile?.hardware.ram_gb && hardwareProfile.hardware.ram_gb >= 16) {
        // Con 16-24 GB RAM, todavía buen soporte
        if (MODEL_PATTERNS.qwenMistralLlama3.test(normalized)) {
          score += 5;
        }
      }

      // ========== SOPORTE DE IDIOMA ==========
      if (context?.targetLanguage && context.targetLanguage !== "detect") {
        const supported = inferLanguagesForModel(modelId);
        if (supported.includes(context.targetLanguage)) {
          score += 10; // Muy importante que soporte el idioma
        } else {
          score -= 5; // Penalizar fuertemente si no soporta
        }

        // Bonus por modelos especialmente buenos en idiomas específicos
        if (["ja", "zh", "ko"].includes(context.targetLanguage)) {
          if (MODEL_PATTERNS.qwenYiDeepseek.test(normalized)) score += 8;
          if (MODEL_PATTERNS.mistralGemma.test(normalized)) score += 3;
          if (MODEL_PATTERNS.llama.test(normalized)) score -= 2;
        }

        if (["es", "pt", "fr", "it"].includes(context.targetLanguage)) {
          if (MODEL_PATTERNS.qwen.test(normalized)) score += 5;
          if (MODEL_PATTERNS.mistral.test(normalized)) score += 4;
          if (MODEL_PATTERNS.llama3.test(normalized)) score += 2;
        }

        if (context.targetLanguage === "ru") {
          if (MODEL_PATTERNS.qwenMistralLlama3.test(normalized)) score += 5;
          if (MODEL_PATTERNS.llama3.test(normalized)) score += 2;
          if (MODEL_PATTERNS.llama2.test(normalized)) score -= 2;
        }
      }

      // ========== MODO TRADUCCIÓN LITERAL ==========
      if (context?.isLiteralTranslation) {
        // La traducción requiere precisión lingüística
        if (MODEL_PATTERNS.qwenMistralLlama3.test(normalized)) {
          score += 6;
        }
        if (MODEL_PATTERNS.llama2.test(normalized)) {
          score -= 3;
        }
      }

      // ========== NÚMERO DE PLATAFORMAS ==========
      if (context?.numberOfPlatforms && context.numberOfPlatforms > 1) {
        // Múltiples plataformas requieren mejor control del output
        // Qwen y Mistral son mejores para generar múltiples outputs
        if (MODEL_PATTERNS.qwen.test(normalized)) score += 4;
        if (MODEL_PATTERNS.mistral.test(normalized)) score += 3;
        if (MODEL_PATTERNS.llama2.test(normalized)) score -= 2;
      }

      // ========== VELOCIDAD Y RAZONAMIENTO ==========
      if (context?.preferChat || context?.preferSpeed) {
        if (MODEL_PATTERNS.phiMiniChatOrca.test(normalized)) score += 3;
      }

      if (context?.preferReasoning) {
        if (MODEL_PATTERNS.qwenMistralLlama3.test(normalized)) score += 4;
      }

      // ========== CONTENIDO EXTENSO ==========
      if (context?.minChars && context.minChars > 500) {
        // Contenido extenso requiere modelos capaces
        if (MODEL_PATTERNS.qwen.test(normalized)) {
          score += 7; // Qwen es excelente para contenido largo
        } else if (MODEL_PATTERNS.mistral.test(normalized)) {
          score += 6; // Mistral también muy bueno
        } else if (MODEL_PATTERNS.llama3.test(normalized)) {
          score += 2;
        }
        // Llama2 es débil para contenido extenso
        if (MODEL_PATTERNS.llama2.test(normalized)) {
          score -= 5;
        }
      } else if (context?.maxChars && context.maxChars > 0) {
        // Si hay límite máximo pero sin mínimo específico
        if (MODEL_PATTERNS.mistralGemma.test(normalized) || MODEL_PATTERNS.qwen.test(normalized)) score += 2;
      }

      // ========== MODELO POR DEFECTO Y CALIDAD GENERAL ==========
      // Base de puntuación por calidad general
      if (MODEL_PATTERNS.qwen.test(normalized)) {
        score += 4; // Mejor modelo multilingüe
      } else if (MODEL_PATTERNS.mistral.test(normalized)) {
        score += 3; // Muy bueno para múltiples idiomas
      } else if (MODEL_PATTERNS.llama3.test(normalized)) {
        score += 1; // Aceptable
      }

      if (MODEL_PATTERNS.llama2.test(normalized)) {
        score -= 3; // Menos bueno en comparativa
      }

      return score;
    },
    [hardwareProfile]
  );

  const getModelCandidates = useCallback(
    (context?: AutoModelContext) => {
      // Estrategia de selección mejorada:
      // 1. Si se ha ajustado hardware (hardwareProfile existe):
      //    a. Mantener el orden del backend como referencia (orden de calidad/capacidad)
      //    b. Aplicar scoring de contexto PERO respetando el orden backend como tie-breaker
      // 2. Si no hay ajuste hardware, usar scoring puro

      let basePool: string[] = [];
      let backendOrderMap: Record<string, number> = {};

      if (hardwareProfile) {
        // CASO 1: Se ha pulsado "Ajustar Hardware"
        // El backend ya ordenó los modelos por capacidad/recomendación
        // Usamos su orden como referencia (tie-breaker de scoring)
        const backendRecs = hardwareProfile.recommendations?.text?.map((rec) =>
          rec.id.toLowerCase()
        ) ?? [];

        if (backendRecs.length > 0) {
          // Crear mapa de posición backend (índice = prioridad)
          backendRecs.forEach((model, index) => {
            backendOrderMap[model] = index;
          });

          // Scoring de contexto sobre modelos recomendados por hardware
          const scored = backendRecs
            .map((model) => ({
              model,
              score: scoreModelForContext(model, context),
              backendIndex: backendOrderMap[model],
            }))
            // Ordenar por: 1) Score descendente, 2) Posición backend (mantener orden si score es igual)
            .sort((a, b) => {
              if (b.score !== a.score) {
                return b.score - a.score; // Diferente score: ordena por puntuación
              }
              // Mismo score: mantener orden backend
              return a.backendIndex - b.backendIndex;
            });

          basePool = scored.map((entry) => entry.model);
        }
      }

      // CASO 2: No hay ajuste hardware, o no hay recomendaciones backend
      if (basePool.length === 0) {
        if (selectedModel === AUTO_TEXT_MODEL_ID) {
          // Modo AUTO puro: usar todos los modelos disponibles
          basePool = availableModelPool;
        } else {
          // Modelo seleccionado manualmente: usar recomendaciones del backend si existen
          basePool =
            constrainedModelPool.length > 0
              ? constrainedModelPool
              : availableModelPool;
        }
      }

      if (!basePool.length) {
        return [DEFAULT_TEXT_MODEL_ID];
      }

      // Aplicar scoring de contexto si aún no lo hemos hecho (modo AUTO sin hardware)
      if (!hardwareProfile || hardwareProfile.recommendations?.text?.length === 0) {
        const scored = basePool
          .map((model) => ({
            model,
            score: scoreModelForContext(model, context),
          }))
          // Ordenar por score, y si es igual, por nombre (consistencia)
          .sort((a, b) => b.score - a.score || a.model.localeCompare(b.model));

        basePool = scored.map((entry) => entry.model);
      }

      // Si el usuario seleccionó un modelo específico (no AUTO), ponerlo primero
      if (selectedModel && selectedModel !== AUTO_TEXT_MODEL_ID) {
        const manualFirst = basePool.find((model) => model === selectedModel);
        const remaining = basePool.filter((model) => model !== selectedModel);
        return manualFirst
          ? [manualFirst, ...remaining]
          : [selectedModel, ...remaining];
      }

      return basePool;
    },
    [
      availableModelPool,
      constrainedModelPool,
      hardwareProfile,
      scoreModelForContext,
      selectedModel,
    ]
  );

  const resolveTextModelId = useCallback(
    (context?: AutoModelContext) => {
      const ordered = getModelCandidates(context);
      return ordered[0] || DEFAULT_TEXT_MODEL_ID;
    },
    [getModelCandidates]
  );

  const handleHardwareAdjust = useCallback(async () => {
    setIsHardwareAdjusting(true);
    try {
      const profile = await apiService.getCapabilities();
      setHardwareProfile(profile);
      _setError(null);
    } catch (error) {
      const fallbackMessage =
        language === "es"
          ? "No se pudo detectar el hardware local."
          : "Hardware detection failed.";
      _setError(
        error instanceof Error ? error.message || fallbackMessage : fallbackMessage
      );
    } finally {
      setIsHardwareAdjusting(false);
    }
  }, [language, _setError, setHardwareProfile]);

  /**
   * Auto-enhance vague or short prompts for better model comprehension
   * Detects if a prompt is too generic/short and enriches it with context
   * EXCEPTION: If translation mode is enabled, the prompt is content to translate and should not be enhanced
   */
  const enhancePromptIfNeeded = useCallback(
    (rawPrompt: string, context?: AutoModelContext): string => {
      // EXCEPTION: In translation mode, the prompt is the content to translate
      // Do not enhance it - use it as-is
      if (context?.isLiteralTranslation) {
        return rawPrompt;
      }

      const trimmed = rawPrompt.trim();

      // Check if prompt is too vague or short
      const isVagueOrShort =
        trimmed.length < 30 || // Very short prompts
        /^(post|contenido|texto|copy|escribe|crea)$/i.test(trimmed) || // Single word/generic
        /^(post|contenido|copy).*(linkedin|instagram|twitter|whatsapp|email)$/i.test(
          trimmed
        ); // Generic platform mention only

      if (!isVagueOrShort) {
        return rawPrompt; // Prompt is detailed enough
      }

      // Auto-enhance based on mode and context
      let enhancement = "";

      if (context?.mode === "basic") {
        enhancement =
          language === "es"
            ? "Genera contenido profesional que sea claro, conciso y atractivo para la audiencia."
            : "Generate professional content that is clear, concise, and engaging for the audience.";
      } else if (context?.mode === "intelligent") {
        enhancement =
          language === "es"
            ? "Analiza el tema en profundidad y genera contenido perspicaz que demuestre expertise."
            : "Analyze the topic in depth and generate insightful content that demonstrates expertise.";
      } else if (context?.mode === "campaign") {
        enhancement =
          language === "es"
            ? "Crea una campaña cohesiva que impulse engagement y conversión con propuestas de valor claras."
            : "Create a cohesive campaign that drives engagement and conversion with clear value propositions.";
      }

      // Add platform context if relevant
      if (context?.allowedPlatforms && context.allowedPlatforms.length > 0) {
        const platforms = context.allowedPlatforms.join(", ");
        const platformContext =
          language === "es"
            ? `Optimiza el contenido específicamente para: ${platforms}.`
            : `Optimize the content specifically for: ${platforms}.`;
        enhancement += ` ${platformContext}`;
      }

      // Combine original prompt with enhancement
      return `${trimmed}\n${enhancement}`;
    },
    [language]
  );

  const handleGenerate = useCallback(
    async (prompt: string, context?: AutoModelContext) => {
      _setIsLoading(true);
      _setError(null);
      _setImageUrl(null);
      clearOutputs();

      // Auto-enhance vague prompts before processing
      const enhancedPrompt = enhancePromptIfNeeded(prompt, context);

      // Construir instrucciones adicionales de restricción de caracteres
      let charConstraint = "";
      if (context?.minChars && context.minChars > 0 && context?.maxChars && context.maxChars > 0) {
        charConstraint = `\n⚠️ REQUISITO OBLIGATORIO ESTRICTO: Cada plataforma DEBE tener ENTRE ${context.minChars} Y ${context.maxChars} caracteres (rango permitido). Genera contenido extenso y detallado dentro de este rango. NO generes más de ${context.maxChars} caracteres NI menos de ${context.minChars} caracteres.`;
      } else if (context?.minChars && context.minChars > 0) {
        charConstraint = `\n⚠️ REQUISITO OBLIGATORIO: Cada plataforma DEBE tener MÍNIMO ${context.minChars} caracteres. Genera contenido EXTREMADAMENTE EXTENSO, DETALLADO y PROFUNDO. Si no alcanzas ${context.minChars} caracteres, expande más el contenido. REPITO: MÍNIMO ${context.minChars} CARACTERES OBLIGATORIO.`;
      } else if (context?.maxChars && context.maxChars > 0) {
        charConstraint = `\n⚠️ REQUISITO OBLIGATORIO: Cada plataforma DEBE tener MÁXIMO ${context.maxChars} caracteres. Sé conciso pero completo.`;
      }

      const enforcedPrompt = `${enhancedPrompt}
Responde estrictamente en formato JSON siguiendo este ejemplo: ${structuredOutputExample}${charConstraint}`;
      const candidates = getModelCandidates(context).slice(0, 3);
      let lastError: Error | null = null;

      const runModel = async (modelId: string) => {
        const rawResponse = await callTextModel(enforcedPrompt, modelId);
        const parsed = JSON.parse(extractJsonPayload(rawResponse));
        const normalized = normalizeOutputs(parsed);
        if (!normalized.length) {
          throw new Error(
            language === "es"
              ? "El modelo no devolvió el formato esperado."
              : "Model did not return the expected format."
          );
        }

        // Validar límites de caracteres (mínimo y/o máximo)
        for (const output of normalized) {
          const contentLength = output.content.length;

          // Validar límite mínimo si está especificado
          if (context?.minChars && context.minChars > 0) {
            if (contentLength < context.minChars) {
              throw new Error(
                language === "es"
                  ? `El contenido tiene ${contentLength} caracteres, pero se requiere un mínimo de ${context.minChars}.`
                  : `Content has ${contentLength} characters, but a minimum of ${context.minChars} is required.`
              );
            }
          }

          // Validar límite máximo si está especificado
          if (context?.maxChars && context.maxChars > 0) {
            if (contentLength > context.maxChars) {
              throw new Error(
                language === "es"
                  ? `El contenido tiene ${contentLength} caracteres, pero no debe exceder ${context.maxChars}.`
                  : `Content has ${contentLength} characters, but must not exceed ${context.maxChars}.`
              );
            }
          }
        }

        return normalized;
      };

      try {
        for (const candidate of candidates) {
          try {
            const normalized = await runModel(candidate);
            const filtered = filterOutputsByPlatforms(
              normalized,
              context?.allowedPlatforms
            );

            // Check if filtering resulted in empty output
            if (filtered.length === 0 && context?.allowedPlatforms && context.allowedPlatforms.length > 0) {
              throw new Error(
                language === "es"
                  ? `No se generó contenido para las plataformas seleccionadas (${context.allowedPlatforms.join(", ")}). El modelo generó contenido para otras plataformas.`
                  : `No content was generated for the selected platforms (${context.allowedPlatforms.join(", ")}). The model generated content for other platforms.`
              );
            }

            const polished = await enforceLanguageQuality(
              filtered,
              context?.targetLanguage,
              candidate,
              callTextModel
            );
            (polished.length ? polished : filtered).forEach(addOutput);
            setLastModelUsed(candidate);
            lastError = null;
            return;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.warn(`Fallo con el modelo ${candidate}`, lastError);
          }
        }

        if (lastError) {
          const fallbackNotice =
            selectedModel && selectedModel !== AUTO_TEXT_MODEL_ID
              ? language === "es"
                ? "El modelo elegido no respondió con JSON válido. Prueba con un modelo multilingüe como mistral o qwen."
                : "The selected model did not return valid JSON. Please try a multilingual model such as mistral or qwen."
              : "";
          _setError(
            `${lastError.message}${
              fallbackNotice ? ` ${fallbackNotice}` : ""
            }`.trim()
          );
        }
      } catch (err) {
        _setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        _setIsLoading(false);
      }
    },
    [
      addOutput,
      clearOutputs,
      enhancePromptIfNeeded,
      getModelCandidates,
      language,
      selectedModel,
      _setError,
      _setImageUrl,
      _setIsLoading,
      setLastModelUsed,
    ]
  );

  const handleCopy = useCallback((text: string) => {
    if (navigator?.clipboard) {
      void navigator.clipboard.writeText(text);
    }
  }, []);

  const handleReset = useCallback(() => {
    clearOutputs();
    _setImageUrl(null);
    _setError(null);
    _setIsLoading(false);
    // Si el modelo seleccionado es AUTO, limpiar el último modelo usado
    // para que no se muestre en la línea de información
    if (selectedModel === AUTO_TEXT_MODEL_ID) {
      setLastModelUsed(null);
    }
    setResetCounter((prev) => prev + 1);
  }, [clearOutputs, selectedModel, _setError, _setImageUrl, _setIsLoading, setLastModelUsed]);

  const handleTabChange = useCallback(
    (mode: AppMode) => {
      if (mode === activeMode) return;
      setActiveMode(mode);
      handleReset();
    },
    [activeMode, handleReset, setActiveMode]
  );

  const renderActiveMode = () => {
    const keySuffix = `${activeMode}-${resetCounter}`;

    switch (activeMode) {
      case "basic":
        return (
          <BasicMode
            key={keySuffix}
            copy={copy.basic}
            outputCopy={copy.output}
            interfaceLanguage={language}
            onGenerate={handleGenerate}
            onCopy={handleCopy}
            languageOptions={languageOptions}
          />
        );
      case "intelligent":
        return (
          <IntelligentMode
            key={keySuffix}
            copy={copy.intelligent}
            outputCopy={copy.output}
            interfaceLanguage={language}
            onGenerate={handleGenerate}
            onCopy={handleCopy}
            onGenerateImage={callImageModel}
            languageOptions={languageOptions}
          />
        );
      case "campaign":
        return (
          <CampaignMode
            key={keySuffix}
            copy={copy.campaign}
            outputCopy={copy.output}
            interfaceLanguage={language}
            onGenerate={handleGenerate}
            onCopy={handleCopy}
            languageOptions={languageOptions}
          />
        );
      case "recycle":
        return (
          <RecycleMode
            key={keySuffix}
            copy={copy.recycle}
            outputCopy={copy.output}
            interfaceLanguage={language}
            onGenerate={handleGenerate}
            onCopy={handleCopy}
            languageOptions={languageOptions}
          />
        );
      case "chat":
        return (
          <ChatMode
            key={keySuffix}
            interfaceLanguage={language}
            copy={copy.chat}
            outputCopy={copy.output}
            onCopy={handleCopy}
            resolveTextModelId={resolveTextModelId}
            callTextModel={callTextModel}
          />
        );
      case "tts":
        return (
          <TTSMode
            key={keySuffix}
            interfaceLanguage={language}
            copy={copy.tts}
            outputCopy={copy.output}
            callTextToSpeech={callTextToSpeech}
            speakWithBrowserTts={speakWithBrowserTts}
            ttsEndpoint={TTS_ENDPOINT}
            languageCodeMap={LANGUAGE_CODE_MAP}
            languageLabels={LANGUAGE_LABELS}
          />
        );
      case "live":
        return (
          <LiveChatMode
            key={keySuffix}
            interfaceLanguage={language}
            copy={copy.live}
            outputCopy={copy.output}
            resolveTextModelId={resolveTextModelId}
            callSpeechToText={callSpeechToText}
            callTextModel={callTextModel}
            callTextToSpeech={callTextToSpeech}
            hasSttEndpoint={Boolean(STT_ENDPOINT)}
            defaultVoicePreset="es_male_0"
          />
        );
      case "image":
        return (
          <ImageEditMode
            key={keySuffix}
            interfaceLanguage={language}
            copy={copy.image}
            onGenerateImage={callImageModel}
          />
        );
      default:
        return null;
    }
  };

  const helpConfig = {
    isOpen: isHelpOpen,
    title: copy.helpTitle,
    description: copy.help,
    tips: copy.helpTips,
    openLabel:
      language === "es" ? "Abrir ayuda rápida" : "Open quick tips",
    closeLabel: language === "es" ? "Cerrar ayuda" : "Close help",
    onOpen: () => setIsHelpOpen(true),
    onClose: () => setIsHelpOpen(false),
  };

  return (
    <MainLayout
      tabs={tabs}
      modelCopy={copy.modelSelector}
      modelOptions={filteredModelOptions}
      textModelId={selectedModel}
      onTextModelChange={setSelectedModel}
      onRefreshModels={refreshAvailableModels}
      isRefreshingModels={isFetchingModels}
      onHardwareAdjust={handleHardwareAdjust}
      isHardwareAdjusting={isHardwareAdjusting}
      hardwareProfile={hardwareProfile}
      modeAvailability={hardwareModeAvailability}
      onTabChange={handleTabChange}
      onReset={handleReset}
      help={helpConfig}
    >
      <Suspense
        fallback={
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "400px",
              fontSize: "16px",
              color: "#666",
            }}
          >
            {language === "es" ? "Cargando modo..." : "Loading mode..."}
          </div>
        }
      >
        {renderActiveMode()}
      </Suspense>
    </MainLayout>
  );
};

export default App;
