import React, { useEffect, useState } from "react";
import type { InterfaceLanguage, VoiceInfo } from "@/types";
import commonStyles from "@/styles/commonStyles";
import { formatCounterText } from "@/utils/text";
import type { OutputCopy } from "@/components/common/OutputDisplay";
import { fetchAvailableTtsVoices } from "@/api/models";
import { DEFAULT_VOICE_PRESETS } from "@/services/audio";

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

type LanguageOption = { value: string; label: string };
type VoiceOption = { value: string; label: string };

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

const normalizeVoiceLanguages = (
  voice: VoiceInfo
): string[] => {
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
      // Fallback: usar los dos primeros caracteres del idioma detectado
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const applyVoices = (voices: VoiceInfo[]) => {
      const { grouped, languageOptions: mappedLanguages } =
        mapVoicesByLanguage(voices, languageCodeMap, languageLabels);

      if (isMounted) {
        setVoiceOptionsByLanguage(grouped);
        setLanguageOptions(mappedLanguages);
        setVoiceLoadError(
          mappedLanguages.length ? null : copy.errors.voices
        );
      }
    };

    const loadVoices = async () => {
      if (!normalizedEndpoint) {
        applyVoices(FALLBACK_VOICES);
        if (isMounted) {
          setVoiceLoadError(copy.errors.unavailable);
        }
        return;
      }

      setAreVoicesLoading(true);
      setVoiceLoadError(null);

      try {
        const remoteVoices = await fetchAvailableTtsVoices(
          normalizedEndpoint
        );

        if (!remoteVoices.length) {
          applyVoices(FALLBACK_VOICES);
          if (isMounted) {
            setVoiceLoadError(copy.errors.voices);
          }
          return;
        }

        applyVoices(remoteVoices);
      } catch (error) {
        console.error("Error al cargar voces TTS:", error);
        applyVoices(FALLBACK_VOICES);
        if (isMounted) {
          setVoiceLoadError(
            error instanceof Error ? error.message : copy.errors.voices
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
    copy.errors.unavailable,
    copy.errors.voices,
    languageCodeMap,
    languageLabels,
    normalizedEndpoint,
  ]);

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
      <div
        style={
          isMobile
            ? commonStyles.inputFrameMobile
            : {
                ...commonStyles.inputFrame,
                padding: "4px 12px 4px 4px",
                overflowY: "hidden",
              }
        }
      >
        <h3 style={commonStyles.frameTitle}>{copy.textLabel}</h3>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: "120px",
            gap: "6px",
          }}
        >
          <textarea
            style={{
              ...commonStyles.textarea,
              height: "100%",
              minHeight: "60px",
              resize: "none",
            }}
            value={textToSpeak}
            onChange={(e) => setTextToSpeak(e.target.value)}
            placeholder={copy.textPlaceholder}
          />
          <div style={{ ...commonStyles.inputCounter, marginTop: 0 }}>
            {formatCounterText(textToSpeak, interfaceLanguage)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            flexShrink: 0,
            paddingTop: "8px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              <label style={{ ...commonStyles.label, fontSize: "0.8em" }}>
                {copy.languageLabel}
              </label>
              <select
                style={{ ...commonStyles.select, padding: "8px" }}
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                disabled={!languageOptions.length || areVoicesLoading}
              >
                {!languageOptions.length && (
                  <option value="" disabled>
                    {areVoicesLoading
                      ? copy.voicesLoading
                      : copy.errors.voices}
                  </option>
                )}
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              <label style={{ ...commonStyles.label, fontSize: "0.8em" }}>
                {copy.voiceLabel}
              </label>
              <select
                style={{ ...commonStyles.select, padding: "8px" }}
                value={selectedVoiceName}
                onChange={(e) => setSelectedVoiceName(e.target.value)}
                disabled={!availableVoices.length || areVoicesLoading}
              >
                {!availableVoices.length && (
                  <option value="" disabled>
                    {areVoicesLoading
                      ? copy.voicesLoading
                      : copy.errors.voices}
                  </option>
                )}
                {availableVoices.map((voice) => (
                  <option key={voice.value} value={voice.value}>
                    {voice.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(areVoicesLoading || voiceLoadError) && (
            <div
              style={{
                fontSize: "0.8rem",
                marginTop: "-4px",
                color: voiceLoadError ? "#b91c1c" : "#475569",
              }}
            >
              {voiceLoadError ?? copy.voicesLoading}
            </div>
          )}
          <button
            type="button"
            style={{ ...commonStyles.generateButton, padding: "12px" }}
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? copy.buttonLoading : copy.buttonIdle}
          </button>
        </div>
      </div>

      <div
        style={
          isMobile ? commonStyles.outputFrameMobile : commonStyles.outputFrame
        }
      >
        <h3 style={commonStyles.frameTitle}>Audio Resultante</h3>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {error && <div style={commonStyles.errorMessage}>{error}</div>}
          {isLoading && (
            <div style={commonStyles.loadingMessage}>
              <div style={commonStyles.spinner}></div>
              <span>{copy.buttonLoading}</span>
            </div>
          )}
          {audioUrl && (
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <audio controls style={{ width: "100%" }} src={audioUrl}></audio>
              <a
                href={audioUrl}
                download="anclora_tts.wav"
                style={{
                  ...commonStyles.copyButton,
                  alignSelf: "center",
                  textDecoration: "none",
                }}
              >
                {outputCopy.downloadAudio}
              </a>
            </div>
          )}
          {!isLoading && !audioUrl && !error && (
            <p style={{ opacity: 0.5 }}>Aquí aparecerá el audio generado</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TTSMode;
