import React, { useEffect, useState } from "react";
import type {
  InterfaceLanguage,
  AutoModelContext,
} from "@/types";
import { languages, recycleOptions, tones } from "@/constants/options";
import { structuredOutputExample } from "@/constants/prompts";
import commonStyles from "@/styles/commonStyles";
import { formatCounterText } from "@/utils/text";
import OutputDisplay, {
  type OutputCopy,
} from "@/components/common/OutputDisplay";
import { useInteraction } from "@/context/InteractionContext";

interface RecycleCopy {
  originalLabel: string;
  originalPlaceholder: string;
  contextLabel: string;
  contextPlaceholder: string;
  formatLabel: string;
  languageLabel: string;
  toneLabel: string;
  buttonIdle: string;
  buttonLoading: string;
  errors: { original: string };
}

type RecycleModeProps = {
  interfaceLanguage: InterfaceLanguage;
  onGenerate: (prompt: string, context?: AutoModelContext) => Promise<void>;
  onCopy: (text: string) => void;
  copy: RecycleCopy;
  outputCopy: OutputCopy;
};

const formatLibrary: Record<string, string> = {
  summary: "Resumen conciso",
  x_thread: "Hilo para X",
  instagram_caption: "Caption para Instagram",
  title_hook: "Título y gancho",
  key_points: "Lista de puntos clave",
  email_launch: "Email de lanzamiento",
  press_release: "Nota de prensa",
};

const RecycleMode: React.FC<RecycleModeProps> = ({
  onGenerate,
  onCopy,
  interfaceLanguage,
  copy,
  outputCopy,
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
  const [inputText, setInputText] = useState("");
  const [context, setContext] = useState("");
  const [format, setFormat] = useState("summary");
  const [language, setLanguage] = useState("es");
  const [tone, setTone] = useState("detect");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => setImageUrl(null), [setImageUrl]);
  useEffect(() => setLanguage(interfaceLanguage), [interfaceLanguage]);

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setError(copy.errors.original);
      return;
    }
    setIsLoading(true);
    setImageUrl(null);
    try {
      const languageDisplay =
        languages.find((l) => l.value === language)?.label || language;
      const toneDisplay = tones.find((t) => t.value === tone)?.label || tone;
      const selectedFormat =
        recycleOptions.find((option) => option.value === format)?.label ||
        formatLibrary[format] ||
        format;
      const prompt = `Convierte el siguiente texto en "${selectedFormat}". Idioma solicitado ${languageDisplay}. Tono ${toneDisplay}. Contexto adicional: "${
        context || "General"
      }". Convierte el siguiente texto manteniendo la coherencia y responde usando ${structuredOutputExample}. Texto: "${inputText}".`;
      await onGenerate(prompt, {
        mode: "recycle",
        preferReasoning: true,
      });
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
        <h3 style={commonStyles.frameTitle}>{copy.originalLabel}</h3>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            flex: 1,
            minHeight: "200px",
          }}
        >
          <textarea
            style={{
              ...commonStyles.textarea,
              height: "100%",
              minHeight: "120px",
              resize: "none",
            }}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={copy.originalPlaceholder}
          />
          <div style={{ ...commonStyles.inputCounter, marginTop: 0 }}>
            {formatCounterText(inputText, interfaceLanguage)}
          </div>
          <textarea
            style={{
              ...commonStyles.textarea,
              height: "80px",
              resize: "none",
            }}
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
              <label style={{ ...commonStyles.label, fontSize: "0.75em" }}>
                {copy.formatLabel}
              </label>
              <select
                style={{
                  ...commonStyles.select,
                  padding: "6px",
                  fontSize: "0.85em",
                }}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                {recycleOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              <label style={{ ...commonStyles.label, fontSize: "0.75em" }}>
                {copy.toneLabel}
              </label>
              <select
                style={{
                  ...commonStyles.select,
                  padding: "6px",
                  fontSize: "0.85em",
                }}
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                {tones.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <label style={{ ...commonStyles.label, fontSize: "0.75em" }}>
                {copy.languageLabel}
              </label>
              <select
                style={{
                  ...commonStyles.select,
                  padding: "6px",
                  fontSize: "0.85em",
                }}
                value={language}
                onChange={(e) => setLanguage(e.target.value as "es" | "en")}
              >
                {languages.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              style={{
                ...commonStyles.generateButton,
                flex: 1.5,
                padding: "8px",
                fontSize: "0.95em",
                height: "36px",
              }}
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? copy.buttonLoading : copy.buttonIdle}
            </button>
          </div>
        </div>
      </div>

      <div
        style={
          isMobile ? commonStyles.outputFrameMobile : commonStyles.outputFrame
        }
      >
        <h3 style={commonStyles.frameTitle}>Resultado</h3>
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

export default RecycleMode;
