import React, { useEffect, useRef, useState } from "react";
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
import type { LanguageOptionAvailability } from "@/constants/modelCapabilities";
import { formatCounterText } from "@/utils/text";
import { useModeState } from "@/context/useContextSelectors";

interface BasicCopy {
  ideaLabel: string;
  ideaPlaceholder: string;
  languageLabel: string;
  toneLabel: string;
  platformLabel: string;
  literalLabel: string;
  minMaxCharsLabel?: string;
  uploadLabel?: string;
  uploadHint?: string;
  buttonIdle: string;
  buttonLiteral?: string;
  buttonLoading: string;
  outputs: string;
  speedDetailed: string;
  speedFlash: string;
  errors: { idea: string; platforms: string; upload?: string };
}

type BasicModeProps = {
  interfaceLanguage: InterfaceLanguage;
  onGenerate: (prompt: string, context?: AutoModelContext) => Promise<void>;
  onCopy: (text: string) => void;
  copy: BasicCopy;
  outputCopy: OutputCopy;
  languageOptions: LanguageOptionAvailability[];
};

const BasicMode: React.FC<BasicModeProps> = ({
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
    setIsLoading: _setIsLoading,
    imageUrl: _imageUrl,
    setImageUrl: _setImageUrl,
  } = useModeState();
  const [idea, setIdea] = useState("");
  const [language, setLanguage] = useState("es");
  const [tone, setTone] = useState("detect");
  const [platforms, setPlatforms] = useState<string[]>([
    "LinkedIn",
    "Instagram",
  ]);
  const [speed, _setSpeed] = useState<"detailed" | "flash">("detailed");
  const [literalTranslation, setLiteralTranslation] = useState(false);
  const [minChars, setMinChars] = useState("");
  const [maxChars, setMaxChars] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedText, setUploadedText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => _setImageUrl(null), [_setImageUrl]);
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

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const normalizedName = file.name?.toLowerCase() ?? "";
    const allowedExtensions = [
      ".txt",
      ".md",
      ".markdown",
      ".csv",
      ".log",
      ".json",
    ];
    const isTextType =
      file.type.startsWith("text/") ||
      allowedExtensions.some((ext) => normalizedName.endsWith(ext));
    if (!isTextType) {
      setError(
        copy.errors.upload ||
          "El archivo debe ser de texto (.txt, .md, .csv, .log)."
      );
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setUploadedText(text);
      setUploadedFileName(file.name);
      setError(null);
      event.target.value = "";
    };
    reader.onerror = () => {
      setError(
        copy.errors.upload ||
          "No se pudo leer el archivo. Intenta con otro formato de texto."
      );
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    const typedIdea = idea.trim();
    const attachedText = uploadedText.trim();
    if (!typedIdea && !attachedText) {
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

    const parsedMin = minChars ? Number.parseInt(minChars, 10) : null;
    const parsedMax = maxChars ? Number.parseInt(maxChars, 10) : null;
    const minCharLimit = Number.isNaN(parsedMin ?? NaN) ? null : parsedMin;
    const maxCharLimit = Number.isNaN(parsedMax ?? NaN) ? null : parsedMax;

    let limitSuffix = "";
    if (minCharLimit && minCharLimit > 0 && maxCharLimit && maxCharLimit > 0) {
      limitSuffix = ` Limita la respuesta entre ${minCharLimit} y ${maxCharLimit} caracteres.`;
    } else if (maxCharLimit && maxCharLimit > 0) {
      limitSuffix = ` Limita la respuesta a un maximo de ${maxCharLimit} caracteres.`;
    } else if (minCharLimit && minCharLimit > 0) {
      limitSuffix = ` Limita la respuesta a un minimo de ${minCharLimit} caracteres.`;
    }
    const requestedPlatforms = literalTranslation
      ? [languageDisplay]
      : platforms;
    const outputExample =
      requestedPlatforms.length > 0
        ? JSON.stringify(
            {
              outputs: requestedPlatforms.map((platform) => ({
                platform,
                content: `Contenido generado para ${platform}`,
              })),
            }
          )
        : structuredOutputExample;
    const combinedIdea = [typedIdea, attachedText]
      .filter(Boolean)
      .join("\n\n---\n\nTexto adjunto:\n");
    const payloadIdea = combinedIdea || typedIdea || attachedText;

    let prompt: string;
    if (literalTranslation) {
      prompt = `Actúa como traductor profesional nativo. Traduce el siguiente texto de forma literal al idioma "${languageDisplay}" sin añadir explicaciones ni notas. Responde ÚNICAMENTE en formato JSON con la estructura { "outputs": [{ "platform": "${languageDisplay}", "content": "texto traducido aquí" }] }. Texto original: """${payloadIdea}""".${limitSuffix}`;
    } else {
      const list =
        requestedPlatforms.length > 0
          ? requestedPlatforms.join(", ")
          : "Sin plataformas";
      const platformConstraint = requestedPlatforms.length === 1
        ? `RESTRICCIÓN CRÍTICA: Genera contenido SOLO para la plataforma "${requestedPlatforms[0]}" y ninguna otra. Tu respuesta debe contener EXACTAMENTE 1 entrada en el array "outputs" con platform: "${requestedPlatforms[0]}". NO generes para otras plataformas.`
        : `RESTRICCIÓN CRÍTICA: Genera contenido SOLO para estas plataformas exactas: ${list}. Tu respuesta debe contener EXACTAMENTE ${requestedPlatforms.length} entradas en el array "outputs", una por cada plataforma listada. NO incluyas plataformas adicionales.`;
      prompt = `Eres un estratega de contenidos experto. Genera una lista JSON bajo la clave "outputs" siguiendo este ejemplo dinámico: ${outputExample}. Idea: """${payloadIdea}""". Idioma solicitado: ${languageDisplay}. Tono: ${toneDisplay}. Plataformas seleccionadas: ${list}. ${platformConstraint} Nivel de detalle: ${speedDisplay}.${limitSuffix} RECUERDA: Responde SOLO con el JSON, sin explicaciones adicionales.`;
    }
      await onGenerate(
        prompt,
        {
          mode: "basic",
          preferSpeed: speed === "flash",
          preferReasoning: speed === "detailed" && !literalTranslation,
          targetLanguage: language,
          allowedPlatforms: requestedPlatforms,
          minChars: minCharLimit,
          maxChars: maxCharLimit,
          isLiteralTranslation: literalTranslation,
          numberOfPlatforms: literalTranslation ? 1 : platforms.length,
          tone: tone,
        }
      );
  };

  const containerStyle = isMobile
    ? commonStyles.twoFrameContainerMobile
    : commonStyles.twoFrameContainer;

  const buttonLabel = isLoading
    ? copy.buttonLoading
    : literalTranslation
    ? copy.buttonLiteral ?? copy.buttonIdle
    : copy.buttonIdle;

  return (
    <div
      style={{
        ...containerStyle,
        flex: 1,
        minHeight: 0,
      }}
    >
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
            {copy.ideaLabel}
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
              onChange={handleFileSelected}
            />
            <button
              type="button"
              style={{
                ...commonStyles.resetButton,
                padding: "6px 12px",
                fontSize: "0.85rem",
                borderRadius: "999px",
              }}
              onClick={handleFileUploadClick}
            >
              {copy.uploadLabel || "Importar texto"}
            </button>
            {(uploadedFileName || copy.uploadHint) && (
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
                {uploadedFileName
                  ? `• ${uploadedFileName}`
                  : copy.uploadHint}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            flex: 1,
            minHeight: 0,
          }}
        >
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
              flex: 1,
              minHeight: 0,
              paddingBottom: "10px",
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

            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
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
                  onChange={(e) => setLiteralTranslation(e.target.checked)}
                />{" "}
                {copy.literalLabel}
              </label>

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
                <span>{copy.minMaxCharsLabel || "Min/Max"}</span>
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
                  onChange={(e) => setMinChars(e.target.value)}
                  placeholder="Min"
                  disabled={literalTranslation}
                  title="Número mínimo de caracteres"
                />
                <span style={{ fontSize: "0.75em", color: "var(--texto-muted)" }}>–</span>
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
                  onChange={(e) => setMaxChars(e.target.value)}
                  placeholder="Max"
                  disabled={literalTranslation}
                  title="Número máximo de caracteres"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          style={{
            ...commonStyles.generateButton,
            marginTop: "auto",
            width: "100%",
            minHeight: "48px",
          }}
          onClick={handleGenerate}
          disabled={isLoading}
        >
          {buttonLabel}
        </button>
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
            imageUrl={_imageUrl}
            copy={outputCopy}
          />
        </div>
      </div>
    </div>
  );
};

export default BasicMode;
