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
  } = useInteraction();

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

  const modelOptions = useMemo(
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

  const resolveTextModelId = useCallback(
    (context?: AutoModelContext) => {
      if (selectedModel && selectedModel !== AUTO_TEXT_MODEL_ID) {
        return selectedModel;
      }

      const pool = Array.from(
        new Set(
          [DEFAULT_TEXT_MODEL_ID, ...availableModels].filter(Boolean)
        )
      );

      if (!pool.length) {
        return DEFAULT_TEXT_MODEL_ID;
      }

      const normalized = pool.map((name) => name.toLowerCase());
      const findByKeywords = (keywords: string[]) => {
        const index = normalized.findIndex((model) =>
          keywords.some((keyword) => model.includes(keyword))
        );
        return index >= 0 ? pool[index] : null;
      };

      if (context?.targetLanguage && context.targetLanguage !== "detect") {
        const lang = context.targetLanguage.toLowerCase();
        const needsCjkSupport = ["ja", "zh", "ko"].includes(lang);
        const needsCyrillicSupport = ["ru"].includes(lang);

        if (needsCjkSupport) {
          const cjkReady = findByKeywords([
            "qwen",
            "yi",
            "gemma",
            "mistral",
          ]);
          if (cjkReady) return cjkReady;
        } else if (needsCyrillicSupport) {
          const cyrillicReady = findByKeywords(["qwen", "mistral", "llama3"]);
          if (cyrillicReady) return cyrillicReady;
        }
      }

      if (context?.preferChat || context?.preferSpeed) {
        const speedy = findByKeywords(["phi", "mini", "chat", "orca"]);
        if (speedy) return speedy;
      }

      if (context?.preferReasoning) {
        const reasoning = findByKeywords(["qwen", "mistral", "llama"]);
        if (reasoning) return reasoning;
      }

      return pool[0] || DEFAULT_TEXT_MODEL_ID;
    },
    [availableModels, selectedModel]
  );

  const handleGenerate = useCallback(
    async (prompt: string, context?: AutoModelContext) => {
      setIsLoading(true);
      setError(null);
      setImageUrl(null);
      clearOutputs();
      try {
        const enforcedPrompt = `${prompt}\nResponde estrictamente en formato JSON siguiendo este ejemplo: ${structuredOutputExample}`;
        const modelIdToUse = resolveTextModelId(context);
        setLastModelUsed(modelIdToUse);
        const rawResponse = await callTextModel(enforcedPrompt, modelIdToUse);
        const parsed = JSON.parse(extractJsonPayload(rawResponse));
        const normalized = normalizeOutputs(parsed);

        if (!normalized.length) {
          setError(
            language === "es"
              ? "El modelo no devolvió el formato esperado."
              : "Model did not return the expected format."
          );
          return;
        }

        normalized.forEach(addOutput);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setIsLoading(false);
      }
    },
    [
      addOutput,
      clearOutputs,
      language,
      resolveTextModelId,
      setError,
      setImageUrl,
      setIsLoading,
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
      modelOptions={modelOptions}
      modelCopy={copy.modelSelector}
      textModelId={selectedModel}
      onTextModelChange={setSelectedModel}
      onRefreshModels={refreshAvailableModels}
      isRefreshingModels={isFetchingModels}
      onTabChange={handleTabChange}
      onReset={handleReset}
      help={helpConfig}
    >
      {renderActiveMode()}
    </MainLayout>
  );
};

export default App;
