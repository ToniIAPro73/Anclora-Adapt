import React, { useEffect, useState } from "react";
import type { InterfaceLanguage } from "../../types";
import commonStyles from "../../styles/commonStyles";
import { formatCounterText } from "../../utils/text";
import type { OutputCopy } from "../common/OutputDisplay";

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
  callTextToSpeech: (text: string, voicePreset: string) => Promise<string>;
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
  const [textToSpeak, setTextToSpeak] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
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
    const controller = new AbortController();

    const fetchVoices = async () => {
      if (!normalizedEndpoint) {
        if (isMounted) {
          setLanguageOptions([]);
          setVoiceOptionsByLanguage({});
          setVoiceLoadError(copy.errors.unavailable);
        }
        return;
      }

      setAreVoicesLoading(true);
      setVoiceLoadError(null);

      try {
        const response = await fetch(
          normalizedEndpoint.replace("/tts", "/voices"),
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(copy.errors.voices);
        }

        const data = await response.json();
        const voices = Array.isArray(data?.voices) ? data.voices : [];
        const languages = new Set<string>();
        const mapped: Record<string, VoiceOption[]> = {};

        voices.forEach((voice: any) => {
          const voiceLangs = Array.isArray(voice?.languages)
            ? voice.languages
            : [];

          Object.entries(languageCodeMap).forEach(([langCode, patterns]) => {
            const matches = patterns.some((pattern) =>
              voiceLangs.some(
                (lang) =>
                  typeof lang === "string" &&
                  lang.toLowerCase().startsWith(pattern.toLowerCase())
              )
            );

            if (matches) {
              if (!mapped[langCode]) {
                mapped[langCode] = [];
              }

              mapped[langCode].push({
                value: voice.id,
                label: voice.name,
              });
              languages.add(langCode);
            }
          });
        });

        const languageList = Array.from(languages)
          .sort()
          .map((langCode) => ({
            value: langCode,
            label: languageLabels[langCode] || langCode,
          }));

        if (isMounted) {
          setVoiceOptionsByLanguage(mapped);
          setLanguageOptions(languageList);
          setVoiceLoadError(
            languageList.length ? null : copy.errors.voices
          );
        }
      } catch (fetchError) {
        if (!controller.signal.aborted && isMounted) {
          console.error("Error al cargar voces TTS:", fetchError);
          setVoiceOptionsByLanguage({});
          setLanguageOptions([]);
          setVoiceLoadError(
            fetchError instanceof Error
              ? fetchError.message
              : copy.errors.voices
          );
        }
      } finally {
        if (isMounted) {
          setAreVoicesLoading(false);
        }
      }
    };

    fetchVoices();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [
    copy.errors.unavailable,
    copy.errors.voices,
    languageCodeMap,
    languageLabels,
    normalizedEndpoint,
  ]);

  useEffect(() => {
    if (!selectedLanguage && languageOptions.length > 0) {
      const preferredLang =
        languageOptions.find((o) => o.value === "es")?.value ||
        languageOptions[0]?.value;
      setSelectedLanguage(preferredLang);
    }
  }, [selectedLanguage, languageOptions]);

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

      const audio = await callTextToSpeech(targetText, selectedVoiceName);
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
