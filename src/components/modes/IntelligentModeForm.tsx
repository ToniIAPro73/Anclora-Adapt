import React from "react";
import type { InterfaceLanguage, LanguageOptionAvailability } from "@/types";
import commonStyles from "@/styles/commonStyles";
import { formatCounterText } from "@/utils/text";
import IntelligentModeImageOptions from "./IntelligentModeImageOptions";

interface IntelligentModeFormProps {
  idea: string;
  onIdeaChange: (value: string) => void;
  interfaceLanguage: InterfaceLanguage;
  context: string;
  onContextChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  deepThinking: boolean;
  onDeepThinkingChange: (value: boolean) => void;
  deepThinkingLabel: string;
  includeImage: boolean;
  onIncludeImageChange: (value: boolean) => void;
  imagePrompt: string;
  onImagePromptChange: (value: string) => void;
  imageFile: File | null;
  imagePreview: string | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  languageOptions: LanguageOptionAvailability[];
  isMobile: boolean;
  isLoading: boolean;
  onGenerate: () => Promise<void>;
}

const IntelligentModeForm: React.FC<IntelligentModeFormProps> = ({
  idea,
  onIdeaChange,
  interfaceLanguage,
  context,
  onContextChange,
  language,
  onLanguageChange,
  deepThinking,
  onDeepThinkingChange,
  deepThinkingLabel,
  includeImage,
  onIncludeImageChange,
  imagePrompt,
  onImagePromptChange,
  imagePreview,
  onFileChange,
  languageOptions,
  isMobile,
  isLoading,
  onGenerate,
}) => {
  return (
    <div
      style={
        isMobile
          ? commonStyles.inputFrameMobile
          : {
              ...commonStyles.inputFrame,
              overflowY: includeImage ? "auto" : "hidden",
              overflowX: "hidden",
              padding: "4px 12px 4px 4px",
              display: "flex",
              flexDirection: "column",
            }
      }
    >
      {/* Idea Section */}
      <h3 style={commonStyles.frameTitle}>Idea</h3>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: includeImage ? "0 0 auto" : "1 1 35%",
          height: includeImage ? "140px" : "auto",
          minHeight: "100px",
          marginBottom: "12px",
          flexShrink: 0,
        }}
      >
        <textarea
          style={{ ...commonStyles.textarea, height: "100%", resize: "none" }}
          value={idea}
          onChange={(e) => onIdeaChange(e.target.value)}
          placeholder="Describe tu idea o tarea..."
        />
        <div style={{ ...commonStyles.inputCounter, marginTop: 0 }}>
          {formatCounterText(idea, interfaceLanguage)}
        </div>
      </div>

      {/* Context Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: includeImage ? "0 0 auto" : "1 1 35%",
          height: includeImage ? "100px" : "auto",
          minHeight: "80px",
          marginBottom: "12px",
          flexShrink: 0,
        }}
      >
        <label
          style={{
            ...commonStyles.label,
            fontSize: "0.8em",
            marginBottom: "2px",
          }}
        >
          Contexto
        </label>
        <textarea
          style={{ ...commonStyles.textarea, height: "100%", resize: "none" }}
          value={context}
          onChange={(e) => onContextChange(e.target.value)}
          placeholder="Añade contexto relevante..."
        />
      </div>

      {/* Options Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flexShrink: 0,
          marginTop: "auto",
          paddingBottom: "2px",
          width: "100%",
          backgroundColor: "var(--panel-bg)",
        }}
      >
        {/* Language and Deep Thinking */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            width: "100%",
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={{ ...commonStyles.label, fontSize: "0.8em" }}>
              Idioma
            </label>
            <select
              style={{
                ...commonStyles.select,
                padding: "6px 10px",
                fontSize: "0.9em",
              }}
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
          <label
            style={{
              ...commonStyles.checkboxChip,
              fontSize: "0.8em",
              padding: "6px 12px",
              margin: "18px 0 0 0",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
            }}
          >
            <input
              type="checkbox"
              checked={deepThinking}
              onChange={(e) => onDeepThinkingChange(e.target.checked)}
              style={{ marginRight: "6px" }}
            />
            {deepThinkingLabel}
          </label>
        </div>

        {/* Image Options */}
        <IntelligentModeImageOptions
          includeImage={includeImage}
          onIncludeImageChange={onIncludeImageChange}
          imagePrompt={imagePrompt}
          onImagePromptChange={onImagePromptChange}
          imageFile={null}
          imagePreview={imagePreview}
          onFileChange={onFileChange}
          imagePromptPlaceholder="Describe la imagen que deseas generar..."
        />

        {/* Generate Button */}
        <button
          type="button"
          style={{
            ...commonStyles.generateButton,
            padding: "12px",
            width: "100%",
          }}
          onClick={onGenerate}
          disabled={isLoading}
        >
          {isLoading ? "Generando..." : "Generar"}
        </button>
      </div>
    </div>
  );
};

export default IntelligentModeForm;
