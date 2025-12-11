import React from "react";
import type { InterfaceLanguage } from "@/types";
import commonStyles from "@/styles/commonStyles";
import { formatCounterText } from "@/utils/text";
import BasicModeOptions from "./BasicModeOptions";
import type { LanguageOptionAvailability } from "@/constants/modelCapabilities";

interface BasicModeFormProps {
  idea: string;
  onIdeaChange: (value: string) => void;
  interfaceLanguage: InterfaceLanguage;
  uploadLabel: string;
  uploadHint?: string;
  uploadedFileName: string | null;
  onFileUploadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
  isMobile: boolean;
  isLoading: boolean;
  buttonLabel: string;
  onGenerate: () => Promise<void>;
  betterPromptLabel: string;
  improvePrompt: boolean;
  onImprovePromptChange: (value: boolean) => void;
}

const BasicModeForm: React.FC<BasicModeFormProps> = ({
  idea,
  onIdeaChange,
  interfaceLanguage,
  uploadLabel,
  uploadHint,
  uploadedFileName,
  onFileUploadClick,
  fileInputRef,
  onFileSelected,
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
  isMobile,
  isLoading,
  buttonLabel,
  onGenerate,
  betterPromptLabel,
  improvePrompt,
  onImprovePromptChange,
}) => {
  return (
    <div
      style={{
        ...(isMobile
          ? commonStyles.inputFrameMobile
          : commonStyles.inputFrame),
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        minHeight: 0,
      }}
    >
      {/* Header with Title and Upload Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ ...commonStyles.frameTitle, marginBottom: 0 }}>
          Idea
        </h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            minWidth: 0,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown,.csv,.log,.json,text/plain"
            style={{ display: "none" }}
            onChange={onFileSelected}
          />
          <button
            type="button"
            style={{
              ...commonStyles.resetButton,
              padding: "6px 12px",
              fontSize: "0.85rem",
              borderRadius: "999px",
            }}
            onClick={onFileUploadClick}
          >
            {uploadLabel}
          </button>
          {(uploadedFileName || uploadHint) && (
            <span
              style={{
                ...commonStyles.settingsHint,
                margin: 0,
                padding: 0,
                color: "var(--texto-muted, #94a3b8)",
                maxWidth: "280px",
                textAlign: "right",
              }}
            >
              {uploadedFileName ? `• ${uploadedFileName}` : uploadHint}
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Idea Textarea */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <textarea
            id="basic-idea"
            style={{
              ...commonStyles.textarea,
              minHeight: "75px",
              maxHeight: "130px",
              height: "clamp(80px, 11vh, 130px)",
              resize: "none" as const,
              lineHeight: 1.35,
            }}
            value={idea}
            onChange={(e) => onIdeaChange(e.target.value)}
            placeholder="Escribe tu idea aquí..."
          />
          <div style={{ ...commonStyles.inputCounter, marginTop: 0 }}>
            {formatCounterText(idea, interfaceLanguage)}
          </div>
        </div>

        {/* Options Section */}
        <BasicModeOptions
          language={language}
          onLanguageChange={onLanguageChange}
          tone={tone}
          onToneChange={onToneChange}
          platforms={platforms}
          onTogglePlatform={onTogglePlatform}
          literalTranslation={literalTranslation}
          onToggleLiteral={onToggleLiteral}
          minChars={minChars}
          onMinCharsChange={onMinCharsChange}
          maxChars={maxChars}
          onMaxCharsChange={onMaxCharsChange}
          languageOptions={languageOptions}
          betterPromptLabel={betterPromptLabel}
          improvePrompt={improvePrompt}
          onImprovePromptChange={onImprovePromptChange}
        />
      </div>

      {/* Generate Button */}
      <button
        type="button"
        style={{
          ...commonStyles.generateButton,
          marginTop: "auto",
          width: "100%",
          minHeight: "48px",
        }}
        onClick={onGenerate}
        disabled={isLoading}
      >
        {buttonLabel}
      </button>
    </div>
  );
};

export default BasicModeForm;
