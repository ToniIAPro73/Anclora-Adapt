import React, { useEffect, useState } from "react";
import type {
  InterfaceLanguage,
  AutoModelContext,
  ImageGenerationOptions,
} from "@/types";
import { languages } from "@/constants/options";
import type { LanguageOptionAvailability } from "@/constants/modelCapabilities";
import { structuredOutputExample } from "@/constants/prompts";
import commonStyles from "@/styles/commonStyles";
import { formatCounterText } from "@/utils/text";
import { fileToBase64 } from "@/utils/files";
import OutputDisplay, {
  type OutputCopy,
} from "@/components/common/OutputDisplay";
import { useModeState } from "@/context/useContextSelectors";

type GenerateImageFn = (
  options: ImageGenerationOptions
) => Promise<string>;

interface IntelligentCopy {
  ideaLabel: string;
  ideaPlaceholder: string;
  contextLabel: string;
  contextPlaceholder: string;
  languageLabel: string;
  deepThinkingLabel: string;
  includeImageLabel: string;
  imagePromptLabel: string;
  imagePromptPlaceholder: string;
  buttonIdle: string;
  buttonLoading: string;
  errors: { idea: string; imagePrompt: string };
}

type IntelligentModeProps = {
  interfaceLanguage: InterfaceLanguage;
  onGenerate: (prompt: string, context?: AutoModelContext) => Promise<void>;
  onCopy: (text: string) => void;
  copy: IntelligentCopy;
  outputCopy: OutputCopy;
  onGenerateImage: GenerateImageFn;
  languageOptions: LanguageOptionAvailability[];
};

const IntelligentMode: React.FC<IntelligentModeProps> = ({
  onGenerate,
  onCopy,
  interfaceLanguage,
  copy,
  outputCopy,
  onGenerateImage,
  languageOptions,
}) => {
  const {
    isLoading,
    error,
    outputs,
    setError,
    setIsLoading,
    imageUrl,
    setImageUrl,
  } = useModeState();
  const [idea, setIdea] = useState("");
  const [context, setContext] = useState("");
  const [language, setLanguage] = useState<string>(interfaceLanguage);
  const [deepThinking, setDeepThinking] = useState(false);
  const [includeImage, setIncludeImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => setImageUrl(null), [setImageUrl]);
  useEffect(() => setLanguage(interfaceLanguage), [interfaceLanguage]);

  const normalizedLanguageOptions =
    languageOptions?.length > 0
      ? languageOptions
      : languages.map((lang) => ({ ...lang, disabled: false }));

  useEffect(() => {
    if (
      !normalizedLanguageOptions.some(
        (option) => option.value === language && !option.disabled
      )
    ) {
      const fallback =
        normalizedLanguageOptions.find((option) => !option.disabled)?.value ||
        "es";
      if (fallback && fallback !== language) {
        setLanguage(fallback);
      }
    }
  }, [normalizedLanguageOptions, language]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError(copy.errors.idea);
      return;
    }
    if (includeImage && !imagePrompt.trim()) {
      setError(copy.errors.imagePrompt);
      return;
    }
    setIsLoading(true);
    setImageUrl(null);
    try {
      const thinking = deepThinking
        ? "Analiza paso a paso."
        : "Responde directo.";
      const languageDisplay =
        languages.find((l) => l.value === language)?.label || language;
      const prompt = `Rol: Estratega. Tarea: "${idea}". Contexto: "${
        context || "General"
      }". Idioma: ${languageDisplay}. ${thinking} Salida JSON: ${structuredOutputExample}`;

      await onGenerate(prompt, {
        mode: "intelligent",
        preferReasoning: true,
        preferSpeed: !deepThinking,
        targetLanguage: language,
      });

      if (includeImage && imagePrompt.trim()) {
        const base64 = imageFile ? await fileToBase64(imageFile) : undefined;
        const imageResult = await onGenerateImage({
          prompt: `${imagePrompt}\nContexto: ${context || "General"}`,
          base64Image: base64,
        });
        setImageUrl(imageResult);
      }
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
                overflowY: includeImage ? "auto" : "hidden",
                overflowX: "hidden",
                padding: "4px 12px 4px 4px",
                display: "flex",
                flexDirection: "column",
              }
        }
      >
        <h3 style={commonStyles.frameTitle}>{copy.ideaLabel}</h3>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: includeImage ? "0 0 auto" : "1 1 auto",
            height: includeImage ? "140px" : "auto",
            minHeight: "100px",
            marginBottom: "12px",
            flexShrink: 0,
          }}
        >
          <textarea
            style={{ ...commonStyles.textarea, height: "100%", resize: "none" }}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={copy.ideaPlaceholder}
          />
          <div style={{ ...commonStyles.inputCounter, marginTop: 0 }}>
            {formatCounterText(idea, interfaceLanguage)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: includeImage ? "0 0 auto" : "1 1 auto",
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
            {copy.contextLabel}
          </label>
          <textarea
            style={{ ...commonStyles.textarea, height: "100%", resize: "none" }}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={copy.contextPlaceholder}
          />
        </div>

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
                {copy.languageLabel}
              </label>
              <select
                style={{
                  ...commonStyles.select,
                  padding: "6px 10px",
                  fontSize: "0.9em",
                }}
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {normalizedLanguageOptions.map((lang) => (
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
                onChange={(e) => setDeepThinking(e.target.checked)}
                style={{ marginRight: "6px" }}
              />
              {copy.deepThinkingLabel}
            </label>
          </div>

          <div
            style={{
              borderTop: "1px solid var(--panel-border)",
              paddingTop: "8px",
              width: "100%",
            }}
          >
            <label
              style={{
                ...commonStyles.checkboxLabel,
                fontSize: "0.85em",
                marginBottom: includeImage ? "6px" : "0",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={includeImage}
                onChange={(e) => setIncludeImage(e.target.checked)}
              />{" "}
              {copy.includeImageLabel}
            </label>

            {includeImage && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  paddingBottom: "4px",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*"
                    style={{
                      fontSize: "0.75em",
                      width: "100%",
                      maxWidth: "100%",
                    }}
                  />
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="mini"
                      style={{
                        width: "30px",
                        height: "30px",
                        objectFit: "cover",
                        borderRadius: "4px",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
                <input
                  type="text"
                  style={{
                    ...commonStyles.select,
                    padding: "6px",
                    fontSize: "0.9em",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder={copy.imagePromptPlaceholder}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            style={{
              ...commonStyles.generateButton,
              padding: "12px",
              width: "100%",
            }}
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
        <h3 style={commonStyles.frameTitle}>Resultados</h3>
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
          <OutputDisplay
            generatedOutputs={outputs.length ? outputs : null}
            error={error}
            isLoading={isLoading}
            onCopy={onCopy}
            audioUrl={null}
            imageUrl={imageUrl}
            copy={outputCopy}
          />
        </div>
      </div>
    </div>
  );
};

export default IntelligentMode;
