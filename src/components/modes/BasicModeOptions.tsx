import React from "react";
import type { LanguageOptionAvailability } from "@/constants/modelCapabilities";
import { tones } from "@/constants/options";
import commonStyles from "@/styles/commonStyles";

interface BasicModeOptionsProps {
  language: string;
  onLanguageChange: (value: string) => void;
  tone: string;
  onToneChange: (value: string) => void;
  platforms: string[];
  onTogglePlatform: (platform: string) => void;
  literalTranslation: boolean;
  onToggleLiteral: (value: boolean) => void;
  minChars: string;
  onMinCharsChange: (value: string) => void;
  maxChars: string;
  onMaxCharsChange: (value: string) => void;
  languageOptions: LanguageOptionAvailability[];
  betterPromptLabel: string;
  improvePrompt: boolean;
  onImprovePromptChange: (value: boolean) => void;
}

const BasicModeOptions: React.FC<BasicModeOptionsProps> = ({
  language,
  onLanguageChange,
  tone,
  onToneChange,
  platforms,
  onTogglePlatform,
  literalTranslation,
  onToggleLiteral,
  minChars,
  onMinCharsChange,
  maxChars,
  onMaxCharsChange,
  languageOptions,
  betterPromptLabel,
  improvePrompt,
  onImprovePromptChange,
}) => {
  const showCharacterLimits = false; // Mantener ocultos por ahora, sin eliminar la lógica
  const platformOptions = ["LinkedIn", "X", "Instagram", "WhatsApp", "Email"];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        flex: 1,
        minHeight: 0,
        paddingBottom: "10px",
      }}
    >
      {/* Language and Tone Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
        }}
      >
        {/* Language Select */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ ...commonStyles.label, fontSize: "0.85em" }}>
            Idioma
          </label>
          <select
            style={{ ...commonStyles.select, padding: "8px" }}
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
          >
            {languageOptions.map((lang) => (
              <option
                key={lang.value}
                value={lang.value}
                disabled={lang.disabled}
                title={lang.disabled ? lang.reason : undefined}
              >
                {lang.label}
                {lang.disabled ? " (no disponible)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Tone Select */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ ...commonStyles.label, fontSize: "0.85em" }}>
            Tono
          </label>
          <select
            style={{ ...commonStyles.select, padding: "8px" }}
            value={tone}
            onChange={(e) => onToneChange(e.target.value)}
            disabled={literalTranslation}
          >
            {tones.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Platform Checkboxes */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label style={{ ...commonStyles.label, fontSize: "0.85em" }}>
          Plataformas
        </label>
        <div style={{ ...commonStyles.checkboxRow, gap: "6px" }}>
          {platformOptions.map((option) => (
            <label
              key={option}
              style={{
                ...commonStyles.checkboxChip,
                padding: "4px 10px",
                fontSize: "0.85em",
                opacity: literalTranslation ? 0.5 : 1,
                cursor: literalTranslation ? "not-allowed" : "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={platforms.includes(option)}
                onChange={() => onTogglePlatform(option)}
                disabled={literalTranslation}
                style={{ marginRight: "4px" }}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      {/* Literal Translation and Min/Max Chars */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(180px, 1fr) auto",
          alignItems: "center",
          gap: "10px",
          paddingBottom: "6px",
          width: "100%",
          marginBottom: "4px",
        }}
      >
        <label
          style={{
            ...commonStyles.checkboxLabel,
            fontSize: "0.85em",
            flex: 1,
            minWidth: "220px",
          }}
        >
          <input
            type="checkbox"
            checked={literalTranslation}
            onChange={(e) => onToggleLiteral(e.target.checked)}
          />{" "}
          Traducción Literal
        </label>

      <label
        style={{
          ...commonStyles.checkboxLabel,
          fontSize: "0.85em",
          flex: 1,
          minWidth: "220px",
        }}
      >
        <input
          type="checkbox"
          checked={improvePrompt}
          onChange={(e) => onImprovePromptChange(e.target.checked)}
          disabled={literalTranslation}
        />{" "}
        {betterPromptLabel}
      </label>

        {showCharacterLimits && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.85em",
              fontWeight: 600,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            <span>Min/Max</span>
            <input
              type="number"
              min="0"
              max="999999999"
              style={{
                ...commonStyles.select,
                width: "70px",
                padding: "4px 8px",
                fontSize: "0.9em",
              }}
              value={minChars}
              onChange={(e) => onMinCharsChange(e.target.value)}
              placeholder="Min"
              disabled={literalTranslation}
              title="Número mínimo de caracteres"
            />
            <span style={{ fontSize: "0.75em", color: "var(--texto-muted)" }}>
              –
            </span>
            <input
              type="number"
              min="0"
              max="999999999"
              style={{
                ...commonStyles.select,
                width: "70px",
                padding: "4px 8px",
                fontSize: "0.9em",
              }}
              value={maxChars}
              onChange={(e) => onMaxCharsChange(e.target.value)}
              placeholder="Max"
              disabled={literalTranslation}
              title="Número máximo de caracteres"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BasicModeOptions;
