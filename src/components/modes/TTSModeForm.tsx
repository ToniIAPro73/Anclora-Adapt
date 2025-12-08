import React from "react";
import type { InterfaceLanguage } from "@/types";
import commonStyles from "@/styles/commonStyles";
import { formatCounterText } from "@/utils/text";

interface LanguageOption {
  value: string;
  label: string;
}

interface VoiceOption {
  value: string;
  label: string;
}

interface TTSModeFormProps {
  textToSpeak: string;
  onTextChange: (value: string) => void;
  interfaceLanguage: InterfaceLanguage;
  selectedLanguage: string;
  onLanguageChange: (value: string) => void;
  selectedVoiceName: string;
  onVoiceChange: (value: string) => void;
  languageOptions: LanguageOption[];
  availableVoices: VoiceOption[];
  areVoicesLoading: boolean;
  voiceLoadError: string | null;
  isMobile: boolean;
  isLoading: boolean;
  buttonLabel: string;
  onGenerate: () => Promise<void>;
}

const TTSModeForm: React.FC<TTSModeFormProps> = ({
  textToSpeak,
  onTextChange,
  interfaceLanguage,
  selectedLanguage,
  onLanguageChange,
  selectedVoiceName,
  onVoiceChange,
  languageOptions,
  availableVoices,
  areVoicesLoading,
  voiceLoadError,
  isMobile,
  isLoading,
  buttonLabel,
  onGenerate,
}) => {
  return (
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
      {/* Text Input Section */}
      <h3 style={commonStyles.frameTitle}>Texto</h3>

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
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Ingresa el texto a sintetizar..."
        />
        <div style={{ ...commonStyles.inputCounter, marginTop: 0 }}>
          {formatCounterText(textToSpeak, interfaceLanguage)}
        </div>
      </div>

      {/* Options Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flexShrink: 0,
          paddingTop: "8px",
        }}
      >
        {/* Language and Voice Selects */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
          }}
        >
          {/* Language Select */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <label style={{ ...commonStyles.label, fontSize: "0.8em" }}>
              Idioma
            </label>
            <select
              style={{ ...commonStyles.select, padding: "8px" }}
              value={selectedLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              disabled={!languageOptions.length || areVoicesLoading}
            >
              {!languageOptions.length && (
                <option value="" disabled>
                  {areVoicesLoading ? "Cargando..." : "Sin voces disponibles"}
                </option>
              )}
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Select */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <label style={{ ...commonStyles.label, fontSize: "0.8em" }}>
              Voz
            </label>
            <select
              style={{ ...commonStyles.select, padding: "8px" }}
              value={selectedVoiceName}
              onChange={(e) => onVoiceChange(e.target.value)}
              disabled={!availableVoices.length || areVoicesLoading}
            >
              {!availableVoices.length && (
                <option value="" disabled>
                  {areVoicesLoading ? "Cargando..." : "Sin voces disponibles"}
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

        {/* Loading/Error Status */}
        {(areVoicesLoading || voiceLoadError) && (
          <div
            style={{
              fontSize: "0.8rem",
              marginTop: "-4px",
              color: voiceLoadError ? "#b91c1c" : "#475569",
            }}
          >
            {voiceLoadError ?? "Cargando voces..."}
          </div>
        )}

        {/* Generate Button */}
        <button
          type="button"
          style={{ ...commonStyles.generateButton, padding: "12px" }}
          onClick={onGenerate}
          disabled={isLoading}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
};

export default TTSModeForm;
