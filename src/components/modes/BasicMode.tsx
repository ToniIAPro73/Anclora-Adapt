import React, { useEffect, useState } from "react";
import type {
  InterfaceLanguage,
  AutoModelContext,
} from "@/types";
import OutputDisplay, {
  type OutputCopy,
} from "@/components/common/OutputDisplay";
import commonStyles from "@/styles/commonStyles";
import { languages, tones } from "@/constants/options";
import { structuredOutputExample } from "@/constants/prompts";
import { formatCounterText } from "@/utils/text";
import { useInteraction } from "@/context/InteractionContext";

interface BasicCopy {
  ideaLabel: string;
  ideaPlaceholder: string;
  languageLabel: string;
  toneLabel: string;
  platformLabel: string;
  literalLabel: string;
  maxCharsLabel?: string;
  buttonIdle: string;
  buttonLoading: string;
  outputs: string;
  speedDetailed: string;
  speedFlash: string;
  errors: { idea: string; platforms: string };
}

type BasicModeProps = {
  interfaceLanguage: InterfaceLanguage;
  onGenerate: (prompt: string, context?: AutoModelContext) => Promise<void>;
  onCopy: (text: string) => void;
  copy: BasicCopy;
  outputCopy: OutputCopy;
};

const BasicMode: React.FC<BasicModeProps> = ({
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
  const [idea, setIdea] = useState("");
  const [language, setLanguage] = useState("es");
  const [tone, setTone] = useState("detect");
  const [platforms, setPlatforms] = useState<string[]>([
    "LinkedIn",
    "Instagram",
  ]);
  const [speed, setSpeed] = useState<"detailed" | "flash">("detailed");
  const [literalTranslation, setLiteralTranslation] = useState(false);
  const [maxChars, setMaxChars] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => setImageUrl(null), [setImageUrl]);
  useEffect(() => setLanguage(interfaceLanguage), [interfaceLanguage]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const togglePlatform = (value: string) => {
    setPlatforms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError(copy.errors.idea);
      return;
    }
    if (!literalTranslation && platforms.length === 0) {
      setError(copy.errors.platforms);
      return;
    }
    const languageDisplay =
      languages.find((l) => l.value === language)?.label || language;
    const toneDisplay = tones.find((t) => t.value === tone)?.label || tone;
    const speedDisplay =
      speed === "detailed" ? copy.speedDetailed : copy.speedFlash;
    const parsedLimit = Number.parseInt(maxChars, 10);
    const charLimit = Number.isNaN(parsedLimit) ? null : parsedLimit;
    const limitSuffix =
      charLimit && charLimit > 0
        ? ` Limita la respuesta a un maximo de ${charLimit} caracteres.`
        : "";
    let prompt: string;
    if (literalTranslation) {
      prompt = `Actua como traductor literal especializado en marketing. Devuelve UNICAMENTE la traduccion en formato JSON bajo la clave "outputs" con UN UNICO elemento SIN plataforma: { "outputs": [{ "content": "traduccion aqui" }] }. Texto original: "${idea}". Idioma de destino: ${languageDisplay}.${limitSuffix}`;
    } else {
      prompt = `Eres un estratega de contenidos. Genera una lista JSON bajo la clave "outputs" siguiendo ${structuredOutputExample}. Idea: "${idea}". Idioma solicitado: ${languageDisplay}. Tono: ${toneDisplay}. Plataformas: ${platforms.join(
        ", "
      )}. Nivel de detalle: ${speedDisplay}.${limitSuffix}`;
    }
      await onGenerate(
        prompt,
        {
          mode: "basic",
          preferSpeed: speed === "flash",
          preferReasoning: speed === "detailed" && !literalTranslation,
        }
      );
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
            id="basic-idea"
            style={{ ...commonStyles.textarea, height: "100%" }}
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
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <label style={{ ...commonStyles.label, fontSize: "0.85em" }}>
                {copy.languageLabel}
              </label>
              <select
                style={{ ...commonStyles.select, padding: "8px" }}
                value={language}
                onChange={(e) => setLanguage(e.target.value as "es" | "en")}
              >
                {languages.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <label style={{ ...commonStyles.label, fontSize: "0.85em" }}>
                {copy.toneLabel}
              </label>
              <select
                style={{ ...commonStyles.select, padding: "8px" }}
                value={tone}
                onChange={(e) => setTone(e.target.value)}
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

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ ...commonStyles.label, fontSize: "0.85em" }}>
              {copy.platformLabel}
            </label>
            <div style={{ ...commonStyles.checkboxRow, gap: "6px" }}>
              {["LinkedIn", "X", "Instagram", "WhatsApp", "Email"].map(
                (option) => (
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
                      onChange={() => togglePlatform(option)}
                      disabled={literalTranslation}
                      style={{ marginRight: "4px" }}
                    />
                    {option}
                  </label>
                )
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <label
              style={{ ...commonStyles.checkboxLabel, fontSize: "0.85em" }}
            >
              <input
                type="checkbox"
                checked={literalTranslation}
                onChange={(e) => setLiteralTranslation(e.target.checked)}
              />{" "}
              {copy.literalLabel}
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.85em", fontWeight: 600 }}>Max:</span>
              <input
                type="number"
                min="0"
                style={{
                  ...commonStyles.select,
                  width: "70px",
                  padding: "4px 8px",
                  fontSize: "0.9em",
                }}
                value={maxChars}
                onChange={(e) => setMaxChars(e.target.value)}
                placeholder="0"
                disabled={literalTranslation}
              />
            </div>
          </div>

          <button
            type="button"
            style={commonStyles.generateButton}
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
        <h3 style={commonStyles.frameTitle}>{copy.outputs || "Resultados"}</h3>
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

export default BasicMode;
