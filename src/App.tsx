import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import BasicMode from "@/components/modes/BasicMode";
import IntelligentMode from "@/components/modes/IntelligentMode";
import CampaignMode from "@/components/modes/CampaignMode";
import RecycleMode from "@/components/modes/RecycleMode";
import ChatMode from "@/components/modes/ChatMode";
import TTSMode from "@/components/modes/TTSMode";
import LiveChatMode from "@/components/modes/LiveChatMode";
import ImageEditMode from "@/components/modes/ImageEditMode";
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
          .replace(/[\s_\-]+/g, "")
      : "";
  const normalizedAllowed = allowed
    .map((platform) => normalizeName(platform))
    .filter(Boolean);
  if (!normalizedAllowed.length) {
    return outputs;
  }
  const filtered: GeneratedOutput[] = [];
  const usedIndexes = new Set<number>();
  normalizedAllowed.forEach((targetName) => {
    const matchIndex = outputs.findIndex((output, index) => {
      if (usedIndexes.has(index) || !output.platform) {
        return false;
      }
      const normalizedPlatform = normalizeName(output.platform);
      return (
        normalizedPlatform === targetName ||
        normalizedPlatform.startsWith(targetName)
      );
    });
    if (matchIndex >= 0) {
      filtered.push(outputs[matchIndex]);
      usedIndexes.add(matchIndex);
    }
  });
  return filtered.length ? filtered : outputs;
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
    isLoading,
    setIsLoading,
    error,
    setError,
    selectedModel,
    setSelectedModel,
    imageUrl,
    setImageUrl,
    setLastModelUsed,
    hardwareProfile,
    setHardwareProfile,
  } = useInteraction();

  const [isHardwareAdjusting, setIsHardwareAdjusting] = useState(false);

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  const copy = translations[language];

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

      if (context?.targetLanguage && context.targetLanguage !== "detect") {
        const supported = inferLanguagesForModel(modelId);
        if (supported.includes(context.targetLanguage)) {
          score += 5;
        } else {
          score -= 2;
        }

        if (["ja", "zh", "ko"].includes(context.targetLanguage)) {
          if (/qwen|yi|deepseek/.test(normalized)) score += 5;
          if (/mistral|gemma/.test(normalized)) score += 2;
        }

        if (["es", "pt", "fr", "it"].includes(context.targetLanguage)) {
          if (/mistral|qwen|llama3/.test(normalized)) score += 3;
        }

        if (context.targetLanguage === "ru") {
          if (/qwen|mistral|llama3/.test(normalized)) score += 3;
        }
      }

      if (context?.preferChat || context?.preferSpeed) {
        if (/phi|mini|chat|orca|gemma/.test(normalized)) score += 2;
      }

      if (context?.preferReasoning) {
        if (/qwen|mistral|llama3/.test(normalized)) score += 2;
      }

      if (/mistral|qwen/.test(normalized)) {
        score += 1;
      }

      if (/llama2/.test(normalized)) {
        score -= 2;
      }

      return score;
    },
    []
  );

  const getModelCandidates = useCallback(
    (context?: AutoModelContext) => {
      if (!constrainedModelPool.length) {
        return [DEFAULT_TEXT_MODEL_ID];
      }

      const scored = constrainedModelPool
        .map((model) => ({
          model,
          score: scoreModelForContext(model, context),
        }))
        .sort((a, b) => b.score - a.score || a.model.localeCompare(b.model));

      if (selectedModel && selectedModel !== AUTO_TEXT_MODEL_ID) {
        const manualFirst = scored.find((entry) => entry.model === selectedModel);
        const remaining = scored.filter(
          (entry) => entry.model !== selectedModel
        );
        return [
          manualFirst?.model || selectedModel,
          ...remaining.map((entry) => entry.model),
        ];
      }

      return scored.map((entry) => entry.model);
    },
    [constrainedModelPool, scoreModelForContext, selectedModel]
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
      setError(null);
    } catch (error) {
      const fallbackMessage =
        language === "es"
          ? "No se pudo detectar el hardware local."
          : "Hardware detection failed.";
      setError(
        error instanceof Error ? error.message || fallbackMessage : fallbackMessage
      );
    } finally {
      setIsHardwareAdjusting(false);
    }
  }, [language, setError, setHardwareProfile]);

  const handleGenerate = useCallback(
    async (prompt: string, context?: AutoModelContext) => {
      setIsLoading(true);
      setError(null);
      setImageUrl(null);
      clearOutputs();

      const enforcedPrompt = `${prompt}
Responde estrictamente en formato JSON siguiendo este ejemplo: ${structuredOutputExample}`;
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
            filtered.forEach(addOutput);
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
          setError(
            `${lastError.message}${
              fallbackNotice ? ` ${fallbackNotice}` : ""
            }`.trim()
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setIsLoading(false);
      }
    },
    [
      addOutput,
      clearOutputs,
      getModelCandidates,
      language,
      selectedModel,
      setError,
      setImageUrl,
      setIsLoading,
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
    setImageUrl(null);
    setError(null);
    setIsLoading(false);
    setResetCounter((prev) => prev + 1);
  }, [clearOutputs, setError, setImageUrl, setIsLoading]);

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
      {renderActiveMode()}
    </MainLayout>
  );
};

export default App;
