import { useEffect, useState } from "react";
import type { InterfaceLanguage, VoiceInfo } from "@/types";
import { fetchAvailableTtsVoices } from "@/api/models";
import { DEFAULT_VOICE_PRESETS } from "@/services/audio";

type LanguageOption = { value: string; label: string };
type VoiceOption = { value: string; label: string };

const FALLBACK_VOICES: VoiceInfo[] = Object.values(DEFAULT_VOICE_PRESETS).map(
  (preset) => ({
    id: preset.id,
    name: preset.name,
    language: preset.language,
    languages:
      preset.languages && preset.languages.length
        ? preset.languages
        : [preset.language],
    gender: preset.gender,
  })
);

const normalizeVoiceLanguages = (voice: VoiceInfo): string[] => {
  const baseLanguages = new Set<string>();
  if (voice.languages?.length) {
    voice.languages.forEach((lang) => {
      if (typeof lang === "string") {
        baseLanguages.add(lang.toLowerCase());
      }
    });
  }
  if (voice.language) {
    baseLanguages.add(voice.language.toLowerCase());
  }
  return Array.from(baseLanguages);
};

const mapVoicesByLanguage = (
  voices: VoiceInfo[],
  languageCodeMap: Record<string, string[]>,
  languageLabels: Record<string, string>
) => {
  const grouped: Record<string, VoiceOption[]> = {};
  const languages = new Set<string>();

  voices.forEach((voice) => {
    const normalizedLanguages = normalizeVoiceLanguages(voice);
    if (!normalizedLanguages.length) return;

    const matchingCodes = new Set<string>();

    Object.entries(languageCodeMap).forEach(([langCode, patterns]) => {
      const hasMatch = patterns.some((pattern) =>
        normalizedLanguages.some((lang) =>
          lang.startsWith(pattern.toLowerCase())
        )
      );
      if (hasMatch) {
        matchingCodes.add(langCode);
      }
    });

    if (!matchingCodes.size) {
      matchingCodes.add(normalizedLanguages[0].slice(0, 2));
    }

    const label = voice.name || voice.id;

    matchingCodes.forEach((code) => {
      if (!grouped[code]) {
        grouped[code] = [];
      }

      grouped[code].push({
        value: voice.id,
        label,
      });
      languages.add(code);
    });
  });

  const languageOptions: LanguageOption[] = Array.from(languages)
    .sort()
    .map((code) => ({
      value: code,
      label: languageLabels[code] || code.toUpperCase(),
    }));

  return { grouped, languageOptions };
};

interface UseTTSModeStateProps {
  interfaceLanguage: InterfaceLanguage;
  ttsEndpoint: string;
  languageCodeMap: Record<string, string[]>;
  languageLabels: Record<string, string>;
  voiceErrorMessages: { unavailable: string; voices: string };
}

/**
 * Custom hook for TTSMode local state management
 * Handles: text input, voice loading, language/voice selection, etc.
 */
export const useTTSModeState = ({
  interfaceLanguage,
  ttsEndpoint,
  languageCodeMap,
  languageLabels,
  voiceErrorMessages,
}: UseTTSModeStateProps) => {
  // Local state
  const [textToSpeak, setTextToSpeak] = useState("");
  const [selectedLanguage, setSelectedLanguage] =
    useState<string>(interfaceLanguage);
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([]);
  const [voiceOptionsByLanguage, setVoiceOptionsByLanguage] = useState<
    Record<string, VoiceOption[]>
  >({});
  const [areVoicesLoading, setAreVoicesLoading] = useState(false);
  const [voiceLoadError, setVoiceLoadError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  const browserTtsSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const availableVoices = voiceOptionsByLanguage[selectedLanguage] || [];
  const normalizedEndpoint = ttsEndpoint?.trim();

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load voices from endpoint
  useEffect(() => {
    let isMounted = true;

    const applyVoices = (voices: VoiceInfo[]) => {
      const { grouped, languageOptions: mappedLanguages } =
        mapVoicesByLanguage(voices, languageCodeMap, languageLabels);

      if (isMounted) {
        setVoiceOptionsByLanguage(grouped);
        setLanguageOptions(mappedLanguages);
        setVoiceLoadError(mappedLanguages.length ? null : voiceErrorMessages.voices);
      }
    };

    const loadVoices = async () => {
      if (!normalizedEndpoint) {
        applyVoices(FALLBACK_VOICES);
        if (isMounted) {
          setVoiceLoadError(voiceErrorMessages.unavailable);
        }
        return;
      }

      setAreVoicesLoading(true);
      setVoiceLoadError(null);

      try {
        const remoteVoices = await fetchAvailableTtsVoices(normalizedEndpoint);

        if (!remoteVoices.length) {
          applyVoices(FALLBACK_VOICES);
          if (isMounted) {
            setVoiceLoadError(voiceErrorMessages.voices);
          }
          return;
        }

        applyVoices(remoteVoices);
      } catch (error) {
        console.error("Error al cargar voces TTS:", error);
        applyVoices(FALLBACK_VOICES);
        if (isMounted) {
          setVoiceLoadError(
            error instanceof Error ? error.message : voiceErrorMessages.voices
          );
        }
      } finally {
        if (isMounted) {
          setAreVoicesLoading(false);
        }
      }
    };

    loadVoices();

    return () => {
      isMounted = false;
    };
  }, [
    voiceErrorMessages.unavailable,
    voiceErrorMessages.voices,
    languageCodeMap,
    languageLabels,
    normalizedEndpoint,
  ]);

  // Set preferred language
  useEffect(() => {
    if (!languageOptions.length) return;

    const preferred =
      languageOptions.find((option) => option.value === interfaceLanguage) ||
      languageOptions[0];

    if (
      preferred &&
      languageOptions.every((option) => option.value !== selectedLanguage)
    ) {
      setSelectedLanguage(preferred.value);
    }
  }, [interfaceLanguage, languageOptions, selectedLanguage]);

  // Auto-select first voice when language changes
  useEffect(() => {
    if (!selectedLanguage) {
      setSelectedVoiceName("");
      return;
    }

    const voices = voiceOptionsByLanguage[selectedLanguage] || [];
    if (!voices.length) {
      setSelectedVoiceName("");
      return;
    }

    setSelectedVoiceName((current) => {
      if (current && voices.some((voice) => voice.value === current)) {
        return current;
      }
      return voices[0].value;
    });
  }, [selectedLanguage, voiceOptionsByLanguage]);

  return {
    // Local state
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
    // Voice data
    languageOptions,
    voiceOptionsByLanguage,
    areVoicesLoading,
    voiceLoadError,
    availableVoices,
    browserTtsSupported,
    normalizedEndpoint,
  };
};
