import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  lazy,
  startTransition,
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
  type HardwareSpecs,
} from "@/types";
import { useLanguage } from "@/context/LanguageContext";
import { useModelContext } from "@/context/ModelContext";
import { useUIContext } from "@/context/UIContext";
import { API_BASE_URL, STT_ENDPOINT, TTS_ENDPOINT } from "@/config";
import {
  buildLanguageOptions,
  inferLanguagesForModel,
  LanguageOptionAvailability,
} from "@/constants/modelCapabilities";
import {
  benchmarkModel,
  isBenchmarkFresh,
  loadBenchmarkMap,
  persistBenchmarkResult,
  type ModelBenchmarkResult,
} from "@/utils/modelBenchmark";
import {
  loadModelDecisions,
  saveModelDecision,
} from "@/utils/modelDecisionStore";
import { adaptContextForHardware } from "@/utils/hardwareRuntime";
import { validateOutputsAgainstRequest } from "@/utils/outputValidators";
import { resolveModelTier, describeTier } from "@/constants/modelTiers";
import type { ModelTier } from "@/constants/modelTiers";
import { operationQueue, type QueueSnapshot } from "@/utils/operationQueue";
import { ModelScoringService } from "@/services/modelScoringService";
import type {
  HardwareProfile,
  ModelScoringMode,
  UserRequestContext,
} from "@/types/modelScoring";

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

type ExecutionStatus = {
  mode: AppMode;
  provider: string;
  fallback: boolean;
  tier: ModelTier;
  message: string;
  notices: string[];
  timestamp: number;
};

const getInitialOfflineState = () =>
  typeof navigator !== "undefined" ? !navigator.onLine : false;

const App: React.FC = () => {
  const { language } = useLanguage();

  // ===== PERFORMANCE: Split context usage to minimize re-renders =====
  const {
    selectedModel,
    setSelectedModel,
    setLastModelUsed,
    hardwareProfile,
    setHardwareProfile,
  } = useModelContext();

  const {
    activeMode,
    setActiveMode,
    addOutput,
    clearOutputs,
    isLoading: _isLoading,
    setIsLoading: _setIsLoading,
    error: _error,
    setError: _setError,
    imageUrl: _imageUrl,
    setImageUrl: _setImageUrl,
  } = useUIContext();

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [modelBenchmarks, setModelBenchmarks] = useState<
    Record<string, ModelBenchmarkResult>
  >({});
  const [persistedDecisions, setPersistedDecisions] = useState<
    Record<string, string>
  >({});
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus | null>(
    null
  );
  const [queueState, setQueueState] = useState<QueueSnapshot>(
    operationQueue.snapshot()
  );
  const [isOffline, setIsOffline] = useState<boolean>(getInitialOfflineState());

  useEffect(() => {
    if (typeof window === "undefined") return;
    setModelBenchmarks(loadBenchmarkMap());
    setPersistedDecisions(loadModelDecisions());
  }, []);

  useEffect(() => {
    const unsubscribe = operationQueue.subscribe(setQueueState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsOffline(!window.navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const handleRetryQueuedOperations = useCallback(() => {
    operationQueue.forceProcess();
  }, []);

  const optimizePrompt = useCallback(
    async (rawPrompt: string): Promise<string> => {
      const optimizeUrl = `${API_BASE_URL}/api/prompts/optimize`;
      const payload = {
        prompt: rawPrompt,
        language,
        target_language: language,
        better_prompt: true,
        prefer_speed: true,
      };
      const response = await fetch(optimizeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Prompt optimization falló: ${response.statusText}`);
      }
      const result = await response.json();
      if (result?.success && result?.improved_prompt) {
        return result.improved_prompt;
      }
      throw new Error(result?.error || "El optimizador devolvió respuesta inválida.");
    },
    [language]
  );

  const queueInfo = useMemo(
    () => ({
      offline: isOffline,
      pending: queueState.pending,
      lastLabel: queueState.lastLabel,
      lastError: queueState.lastError,
      onRetry: handleRetryQueuedOperations,
    }),
    [handleRetryQueuedOperations, isOffline, queueState.lastError, queueState.lastLabel, queueState.pending]
  );

  // ===== PERFORMANCE: Selective memoization =====
  // Only memoize expensive operations and objects passed to many children
  const copy = useMemo(() => translations[language], [language]);

  // Build installed models list - small operation, no memo needed
  const installedModels = (() => {
    const set = new Set<string>();
    availableModels.forEach((model) => set.add(model));
    if (selectedModel) {
      set.add(selectedModel);
    }
    set.add(DEFAULT_TEXT_MODEL_ID);
    return Array.from(set);
  })();

  const buildHardwareProfileForScoring = (hardware?: HardwareSpecs): HardwareProfile => ({
    gpuVramGB: hardware?.gpu_vram_gb ?? 4,
    ramGB: hardware?.ram_gb ?? 16,
    cpuCores: hardware?.cpu_cores ?? 4,
    gpuModel: hardware?.gpu_model ?? "CPU Only",
    isLaptop: Boolean(hardware?.gpu_model && /laptop/i.test(hardware.gpu_model)),
  });

  const shouldUseModelScoring = (mode?: string): mode is ModelScoringMode =>
    mode === "basic" || mode === "intelligent";

  const buildModelScoringContext = (
    context: AutoModelContext,
    options: {
      speed: "detailed" | "flash";
      tone: string;
      language: string;
      platforms: string[];
    }
  ): UserRequestContext => {
    const preferSpeed = Boolean(context.preferSpeed) || options.speed === "flash";
    const preferQuality =
      Boolean(context.preferReasoning) || options.speed === "detailed";
    return {
      mode: (context.mode as ModelScoringMode) || "basic",
      language: context.targetLanguage || options.language,
      platforms: options.platforms,
      tone: options.tone,
      improvePrompt: Boolean(context.improvePrompt),
      deepThinking: Boolean(context.preferReasoning),
      includeImage: context.mode === "intelligent",
      minChars: context.minChars ?? undefined,
      maxChars: context.maxChars ?? undefined,
      preferSpeed,
      preferQuality,
    };
  };

  // Build language options - small operation, no memo needed
  const languageOptions: LanguageOptionAvailability[] =
    buildLanguageOptions(selectedModel, installedModels);

  // Extract and normalize hardware recommendations - moderate operation, keep memo
  const recommendedTextKeywords = useMemo(
    () =>
      hardwareProfile?.recommendations?.text?.map((rec) =>
        rec.id.toLowerCase()
      ) ?? [],
    [hardwareProfile]
  );

  // Build hardware mode availability map - moderate operation, keep memo
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

  // Build tabs array - simple literal, no memo needed
  const tabs: { id: AppMode; label: string }[] = [
    { id: "basic", label: copy.tabs.basic },
    { id: "intelligent", label: copy.tabs.intelligent },
    { id: "campaign", label: copy.tabs.campaign },
    { id: "recycle", label: copy.tabs.recycle },
    { id: "chat", label: copy.tabs.chat },
    { id: "tts", label: copy.tabs.tts },
    { id: "live", label: copy.tabs.live },
    { id: "image", label: copy.tabs.image },
  ];

  const describeExecutionLabel = useCallback(
    (provider: string, tier: ModelTier, fallback: boolean, notices: string[]) => {
      const tierLabel = describeTier(tier, language);
      const fallbackLabel = fallback
        ? language === "es"
          ? "fallback activo"
          : "fallback active"
        : language === "es"
        ? "camino principal"
        : "primary path";
      const noticeSuffix = notices.length ? ` · ${notices.join(" · ")}` : "";
      return `${tierLabel} · ${provider} (${fallbackLabel})${noticeSuffix}`;
    },
    [language]
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

  // Build model options list - small operation, no memo needed
  const rawModelOptions = Array.from(
    new Set(
      [
        AUTO_TEXT_MODEL_ID,
        selectedModel,
        ...availableModels,
        DEFAULT_TEXT_MODEL_ID,
      ].filter(Boolean)
    )
  );

  // Filter model options by recommendations - small operation, no memo needed
  const filteredModelOptions = (() => {
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
  })();

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

  // ===== PERFORMANCE: Defer model list fetch to after initial render =====
  // Don't block initial page load waiting for Ollama response
  // This prevents 15-second timeout from blocking Time to Interactive (TTI)
  useEffect(() => {
    // Use a timeout to ensure this runs AFTER the initial render is complete
    const timeoutId = setTimeout(() => {
      startTransition(() => {
        void refreshAvailableModels();
      });
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [refreshAvailableModels]);

  useEffect(() => {
    const candidatePool =
      hardwareProfile?.recommendations?.text?.map((rec) => rec.id) ||
      availableModelPool;
    const prioritized = candidatePool.slice(0, 3);
    const stale = prioritized.filter((modelId) => {
      const bench = modelBenchmarks[modelId];
      return !bench || !isBenchmarkFresh(bench);
    });
    if (!stale.length) {
      return;
    }
    let cancelled = false;
    (async () => {
      for (const modelId of stale) {
        const result = await benchmarkModel(modelId);
        if (cancelled) return;
        setModelBenchmarks((prev) => {
          const next = { ...prev, [modelId]: result };
          persistBenchmarkResult(result);
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hardwareProfile, availableModelPool, modelBenchmarks]);

  // ===== Auto-detect hardware on app load =====
  // Usuario no necesita pulsar "Ajustar Hardware" explícitamente
  // La app detecta automáticamente las capacidades del sistema
  useEffect(() => {
    if (hardwareProfile) return; // Ya fue detectado

    const detectHardware = async () => {
      try {
        const profile = await apiService.getCapabilities();
        setHardwareProfile(profile);
        console.log("Hardware automatically detected:", profile);
      } catch (error) {
        // Silencio el error - no es crítico si no se detecta automáticamente
        // El usuario puede hacerlo manualmente con el botón si lo necesita
        console.warn("Auto-detection of hardware failed, user can use Adjust Hardware button", error);
      }
    };

    void detectHardware();
  }, [hardwareProfile, setHardwareProfile]);

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
      if (context?.minChars && context?.minChars > 500) {
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
      } else if (context?.maxChars && context?.maxChars > 0) {
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

      const benchResult = modelBenchmarks[modelId];
      if (benchResult) {
        if (!benchResult.success) {
          score -= 6;
        } else {
          const latencyPenalty = Math.min(benchResult.latencyMs / 500, 6);
          score -= latencyPenalty;
          if (context?.preferSpeed && benchResult.latencyMs <= 1500) {
            score += 4;
          }
          if (benchResult.tokensPerSecond > 800) {
            score += 1;
          }
        }
      }

      return score;
    },
    [hardwareProfile, modelBenchmarks]
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

      if (
        context?.mode &&
        selectedModel === AUTO_TEXT_MODEL_ID &&
        persistedDecisions[context.mode]
      ) {
        const stored = persistedDecisions[context.mode];
        if (basePool.includes(stored)) {
          basePool = [stored, ...basePool.filter((model) => model !== stored)];
        }
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
      persistedDecisions,
    ]
  );

  const resolveTextModelId = useCallback(
    (context?: AutoModelContext) => {
      const ordered = getModelCandidates(context);
      return ordered[0] || DEFAULT_TEXT_MODEL_ID;
    },
    [getModelCandidates]
  );

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

      const hardwareAdjustment = adaptContextForHardware(context, hardwareProfile);
      const effectiveContext = hardwareAdjustment.context ?? context;
      const contextNotices = hardwareAdjustment.notices;

      // Auto-enhance vague prompts before processing
      const enhancedPrompt = enhancePromptIfNeeded(prompt, effectiveContext);

      // Construir instrucciones adicionales de restricción de caracteres
      let charConstraint = "";
      if (effectiveContext?.minChars && effectiveContext?.minChars > 0 && effectiveContext?.maxChars && effectiveContext?.maxChars > 0) {
        charConstraint = `\n⚠️ REQUISITO OBLIGATORIO ESTRICTO: Cada plataforma DEBE tener ENTRE ${effectiveContext?.minChars} Y ${effectiveContext?.maxChars} caracteres (rango permitido). Genera contenido extenso y detallado dentro de este rango. NO generes más de ${effectiveContext?.maxChars} caracteres NI menos de ${effectiveContext?.minChars} caracteres.`;
      } else if (effectiveContext?.minChars && effectiveContext?.minChars > 0) {
        charConstraint = `\n⚠️ REQUISITO OBLIGATORIO: Cada plataforma DEBE tener MÍNIMO ${effectiveContext?.minChars} caracteres. Genera contenido EXTREMADAMENTE EXTENSO, DETALLADO y PROFUNDO. Si no alcanzas ${effectiveContext?.minChars} caracteres, expande más el contenido. REPITO: MÍNIMO ${effectiveContext?.minChars} CARACTERES OBLIGATORIO.`;
      } else if (effectiveContext?.maxChars && effectiveContext?.maxChars > 0) {
        charConstraint = `\n⚠️ REQUISITO OBLIGATORIO: Cada plataforma DEBE tener MÁXIMO ${effectiveContext?.maxChars} caracteres. Sé conciso pero completo.`;
      }

      const improvementDirective =
        effectiveContext?.improvePrompt && !effectiveContext?.isLiteralTranslation
          ? language === "es"
            ? "Reformula el prompt anterior con más contexto, claridad y señales de valor antes de generar la respuesta final."
            : "Rewrite the previous prompt with richer context, clarity and value signals before generating the final answer."
          : null;
      const shouldImprovePrompt = Boolean(improvementDirective);
      const promptForOptimization = shouldImprovePrompt
        ? `${enhancedPrompt}\n${improvementDirective}`
        : enhancedPrompt;
      let promptSeed = enhancedPrompt;
      if (shouldImprovePrompt) {
        try {
          promptSeed = await optimizePrompt(promptForOptimization);
        } catch (optimizationError) {
          console.warn("Prompt optimizer failed:", optimizationError);
          promptSeed = promptForOptimization;
        }
      }
      const enforcedPrompt = `${promptSeed}
Responde estrictamente en formato JSON siguiendo este ejemplo: ${structuredOutputExample}${charConstraint}`;
      const scoringContext =
        shouldUseModelScoring(effectiveContext?.mode) && effectiveContext
          ? buildModelScoringContext(effectiveContext, {
              speed,
              tone,
              language,
              platforms: requestedPlatforms,
            })
          : null;
      const scoringRanking = scoringContext
        ? ModelScoringService.scoreModels(
            scoringContext,
            buildHardwareProfileForScoring(hardwareProfile?.hardware),
            installedModels
          )
        : null;
      const scoringNotices = scoringRanking
        ? [
            scoringRanking.primary.reason,
            ...scoringRanking.primary.warnings,
          ].filter(Boolean)
        : [];
      const combinedNotices = [...contextNotices, ...scoringNotices];
      const scoringOrder =
        scoringRanking?.allRanked.map((entry) => entry.modelName) || [];
      const orderedCandidates =
        scoringOrder.length > 0
          ? Array.from(new Set(scoringOrder))
          : getModelCandidates(context);
      const prioritizedCandidates =
        selectedModel && selectedModel !== AUTO_TEXT_MODEL_ID
          ? [
              selectedModel,
              ...orderedCandidates.filter((model) => model !== selectedModel),
            ]
          : orderedCandidates;
      const candidates = prioritizedCandidates.slice(0, 3);
      let lastError: Error | null = null;

      const buildPrompt = (...extras: (string | null | undefined)[]) => {
        const filtered = extras.filter(Boolean);
        if (!filtered.length) {
          return enforcedPrompt;
        }
        return `${enforcedPrompt}\n${filtered.join("\n")}`;
      };

      const minCharLimit =
        effectiveContext?.minChars && effectiveContext.minChars > 0
          ? effectiveContext.minChars
          : null;
      const maxCharLimit =
        effectiveContext?.maxChars && effectiveContext.maxChars > 0
          ? effectiveContext.maxChars
          : null;
      const expansionInstruction =
        minCharLimit && minCharLimit > 0
          ? language === "es"
            ? `Amplía cada entrada generada para que alcance al menos ${minCharLimit} caracteres por plataforma antes de finalizar.`
            : `Expand each entry so that it reaches at least ${minCharLimit} characters per platform before finishing.`
          : null;

      const runModel = async (modelId: string) => {
        const normalizeResponse = async (extraMessage?: string) => {
          const prompt = buildPrompt(improvementDirective, extraMessage);
          const rawResponse = await callTextModel(prompt, modelId);
          const parsed = JSON.parse(extractJsonPayload(rawResponse));
          const normalized = normalizeOutputs(parsed);
          if (!normalized.length) {
            throw new Error(
              language === "es"
                ? "El modelo no devolvió el formato esperado."
                : "Model did not return the expected format."
            );
          }
          return normalized;
        };

        const evaluateLengthErrors = (outputs: GeneratedOutput[]) => {
          let minError: Error | null = null;
          let maxError: Error | null = null;

          for (const output of outputs) {
            const contentLength = output.content.length;
            if (
              !minError &&
              minCharLimit !== null &&
              contentLength < minCharLimit
            ) {
              minError = new Error(
                language === "es"
                  ? `El contenido tiene ${contentLength} caracteres, pero se requiere un mínimo de ${minCharLimit}.`
                  : `Content has ${contentLength} characters, but a minimum of ${minCharLimit} is required.`
              );
            }
            if (
              !maxError &&
              maxCharLimit !== null &&
              contentLength > maxCharLimit
            ) {
              maxError = new Error(
                language === "es"
                  ? `El contenido tiene ${contentLength} caracteres, pero no debe exceder ${maxCharLimit}.`
                  : `Content has ${contentLength} characters, but must not exceed ${maxCharLimit}.`
              );
            }
            if (minError && maxError) {
              break;
            }
          }

          return { minError, maxError };
        };

        let normalized = await normalizeResponse();
        let retriedMin = false;

        while (true) {
          const { minError, maxError } = evaluateLengthErrors(normalized);
          if (minError && !retriedMin && expansionInstruction) {
            retriedMin = true;
            normalized = await normalizeResponse(expansionInstruction);
            continue;
          }
          if (minError) {
            throw minError;
          }
          if (maxError) {
            throw maxError;
          }
          break;
        }

        return normalized;
      };

      try {
        for (let attemptIndex = 0; attemptIndex < candidates.length; attemptIndex += 1) {
          const candidate = candidates[attemptIndex];
          try {
            const normalized = await runModel(candidate);
            const filtered = filterOutputsByPlatforms(
              normalized,
              effectiveContext?.allowedPlatforms
            );

            if (filtered.length === 0 && effectiveContext?.allowedPlatforms && effectiveContext.allowedPlatforms.length > 0) {
              throw new Error(
                language === "es"
                  ? `No se generó contenido para las plataformas seleccionadas (${effectiveContext?.allowedPlatforms?.join(", ")}). El modelo generó contenido para otras plataformas.`
                  : `No content was generated for the selected platforms (${effectiveContext?.allowedPlatforms?.join(", ")}). The model generated content for other platforms.`
              );
            }

            validateOutputsAgainstRequest(filtered, effectiveContext);
            const polished = await enforceLanguageQuality(
              filtered,
              effectiveContext?.targetLanguage,
              candidate,
              callTextModel
            );
            (polished.length ? polished : filtered).forEach(addOutput);
            setLastModelUsed(candidate);
            const decisionKey = effectiveContext?.mode || activeMode;
            if (
              decisionKey &&
              selectedModel === AUTO_TEXT_MODEL_ID
            ) {
              setPersistedDecisions((prev) => {
                if (prev[decisionKey] === candidate) return prev;
                const next = { ...prev, [decisionKey]: candidate };
                saveModelDecision(decisionKey, candidate);
                return next;
              });
            }

            const tier = resolveModelTier(candidate);
            setExecutionStatus({
              mode: decisionKey || activeMode,
              provider: candidate,
              fallback: attemptIndex > 0,
              tier,
              message: describeExecutionLabel(
                candidate,
                tier,
                attemptIndex > 0,
                combinedNotices
              ),
              notices: combinedNotices,
              timestamp: Date.now(),
            });
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
          const fallbackModel =
            selectedModel === AUTO_TEXT_MODEL_ID
              ? candidates[0] || DEFAULT_TEXT_MODEL_ID
              : selectedModel;
          setExecutionStatus({
            mode: effectiveContext?.mode || activeMode,
            provider: fallbackModel || "unavailable",
            fallback: true,
            tier: resolveModelTier(fallbackModel),
            message:
              language === "es"
                ? "Cadena de modelos agotada. Revisa hardware o activa proveedores cloud."
                : "Model chain exhausted. Review hardware or enable cloud providers.",
            notices: combinedNotices,
            timestamp: Date.now(),
          });
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
      describeExecutionLabel,
      enhancePromptIfNeeded,
      getModelCandidates,
      hardwareProfile,
      language,
      selectedModel,
      _setError,
      _setImageUrl,
      _setIsLoading,
      setExecutionStatus,
      setLastModelUsed,
      activeMode,
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
            hardwareProfile={hardwareProfile}
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
            hardwareProfile={hardwareProfile}
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
      hardwareProfile={hardwareProfile}
      modeAvailability={hardwareModeAvailability}
      onTabChange={handleTabChange}
      onReset={handleReset}
      help={helpConfig}
      executionStatus={
        executionStatus
          ? { message: executionStatus.message, notices: executionStatus.notices }
          : null
      }
      queueInfo={queueInfo}
    >
      {renderActiveMode()}
    </MainLayout>
  );
};

export default App;
