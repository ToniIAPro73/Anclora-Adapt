import React, { useEffect, useState } from "react";
import type {
  InterfaceLanguage,
  AutoModelContext,
} from "@/types";
import { languages } from "@/constants/options";
import type { LanguageOptionAvailability } from "@/constants/modelCapabilities";
import { structuredOutputExample } from "@/constants/prompts";
import commonStyles from "@/styles/commonStyles";
import OutputDisplay, {
  type OutputCopy,
} from "@/components/common/OutputDisplay";
import { useInteraction } from "@/context/InteractionContext";

interface CampaignCopy {
  ideaLabel: string;
  ideaPlaceholder: string;
  contextLabel: string;
  contextPlaceholder: string;
  languageLabel: string;
  buttonIdle: string;
  buttonLoading: string;
  errors: { idea: string };
}

type CampaignModeProps = {
  interfaceLanguage: InterfaceLanguage;
  onGenerate: (prompt: string, context?: AutoModelContext) => Promise<void>;
  onCopy: (text: string) => void;
  copy: CampaignCopy;
  outputCopy: OutputCopy;
  languageOptions: LanguageOptionAvailability[];
};

const campaignPlatforms = ["LinkedIn", "X", "Instagram", "Email"];

const CampaignMode: React.FC<CampaignModeProps> = ({
  onGenerate,
  onCopy,
  interfaceLanguage,
  copy,
  outputCopy,
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
  } = useInteraction();
  const [idea, setIdea] = useState("");
  const [context, setContext] = useState("");
  const [language, setLanguage] = useState("es");
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

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError(copy.errors.idea);
      return;
    }
    setIsLoading(true);
    setImageUrl(null);
    try {
      const selectedLanguage = languages.find(
        (lang) => lang.value === language
      ) ?? {
        value: language,
        label: language,
      };
      const languageDisplay =
        selectedLanguage.value === "detect"
          ? `${selectedLanguage.label} (auto)`
          : `${selectedLanguage.label} (${selectedLanguage.value})`;
      const languageReminder =
        interfaceLanguage === "es"
          ? `Redacta todos los contenidos solo en ${selectedLanguage.label}, sin mezclar idiomas.`
          : `Write every content block strictly in ${selectedLanguage.label} and do not mix languages.`;
      const prompt = `Rol: Planificador de campanas. Idea: "${idea}". Contexto: "${
        context || "No especificado"
      }". Idioma: ${languageDisplay}. ${languageReminder} Plataformas: ${campaignPlatforms.join(
        ", "
      )}. Sigue el esquema ${structuredOutputExample}.`;
      await onGenerate(prompt, {
        mode: "campaign",
        preferReasoning: true,
        targetLanguage: language,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
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
        <h3 style={commonStyles.frameTitle}>{copy.ideaLabel}</h3>
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
            style={{ ...commonStyles.textarea, height: "100%" }}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={copy.ideaPlaceholder}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            marginTop: "12px",
          }}
        >
          <label style={{ ...commonStyles.label, fontSize: "0.85em" }}>
            {copy.contextLabel}
          </label>
          <textarea
            style={{ ...commonStyles.textarea, minHeight: "80px" }}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={copy.contextPlaceholder}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={{ ...commonStyles.label, fontSize: "0.85em" }}>
              {copy.languageLabel}
            </label>
            <select
              style={{ ...commonStyles.select, padding: "8px" }}
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
          <button
            type="button"
            style={{
              ...commonStyles.generateButton,
              padding: "10px 16px",
              minWidth: "180px",
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

export default CampaignMode;
