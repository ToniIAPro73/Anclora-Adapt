import React from "react";
import type { InterfaceLanguage } from "@/types";
import commonStyles from "@/styles/commonStyles";
import type { OutputCopy } from "@/components/common/OutputDisplay";
import { useTTSModeState } from "./useTTSModeState";
import TTSModeForm from "./TTSModeForm";
import TTSModeOutput from "./TTSModeOutput";

interface TtsCopy {
  textLabel: string;
  textPlaceholder: string;
  languageLabel: string;
  voiceLabel: string;
  buttonIdle: string;
  buttonLoading: string;
  voicesLoading: string;
  noticeFallback: string;
  errors: { text: string; unavailable: string; voices: string };
}

type TTSModeProps = {
  interfaceLanguage: InterfaceLanguage;
  copy: TtsCopy;
  outputCopy: OutputCopy;
  callTextToSpeech: (
    text: string,
    voicePreset: string,
    language?: string
  ) => Promise<string>;
  speakWithBrowserTts: (text: string, language: string) => Promise<void>;
  ttsEndpoint: string;
  languageCodeMap: Record<string, string[]>;
  languageLabels: Record<string, string>;
};

const TTSMode: React.FC<TTSModeProps> = ({
  interfaceLanguage,
  copy,
  outputCopy,
  callTextToSpeech,
  speakWithBrowserTts,
  ttsEndpoint,
  languageCodeMap,
  languageLabels,
}) => {
  // Use custom hook for local state management
  const {
    textToSpeak,
    setTextToSpeak,
    selectedLanguage,
    setSelectedLanguage,
    selectedVoiceName,
    setSelectedVoiceName,
    audioUrl,
    setAudioUrl,
    isLoading,
    setIsLoading,
    error,
    setError,
    isMobile,
    languageOptions,
    availableVoices,
    areVoicesLoading,
    voiceLoadError,
    browserTtsSupported,
    normalizedEndpoint,
  } = useTTSModeState({
    interfaceLanguage,
    ttsEndpoint,
    languageCodeMap,
    languageLabels,
    voiceErrorMessages: {
      unavailable: copy.errors.unavailable,
      voices: copy.errors.voices,
    },
  });

  const handleGenerate = async () => {
    if (!textToSpeak.trim()) {
      setError(copy.errors.text);
      return;
    }
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      const targetText = textToSpeak.trim();

      if (!normalizedEndpoint) {
        if (!browserTtsSupported) {
          setError(copy.errors.unavailable);
        } else {
          await speakWithBrowserTts(targetText, selectedLanguage);
          setError(copy.noticeFallback);
        }
        return;
      }

      if (!selectedVoiceName) {
        setError(copy.errors.voices);
        return;
      }

      const audio = await callTextToSpeech(
        targetText,
        selectedVoiceName,
        selectedLanguage || interfaceLanguage
      );
      setAudioUrl(audio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={
        isMobile
          ? commonStyles.twoFrameContainerMobile
          : commonStyles.twoFrameContainer
      }
    >
      {/* Input Form Section */}
      <TTSModeForm
        textToSpeak={textToSpeak}
        onTextChange={setTextToSpeak}
        interfaceLanguage={interfaceLanguage}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
        selectedVoiceName={selectedVoiceName}
        onVoiceChange={setSelectedVoiceName}
        languageOptions={languageOptions}
        availableVoices={availableVoices}
        areVoicesLoading={areVoicesLoading}
        voiceLoadError={voiceLoadError}
        isMobile={isMobile}
        isLoading={isLoading}
        buttonLabel={isLoading ? copy.buttonLoading : copy.buttonIdle}
        onGenerate={handleGenerate}
      />

      {/* Output Display Section */}
      <TTSModeOutput
        audioUrl={audioUrl}
        isLoading={isLoading}
        error={error}
        buttonLoading={copy.buttonLoading}
        outputCopy={outputCopy}
        isMobile={isMobile}
      />
    </div>
  );
};

export default TTSMode;
