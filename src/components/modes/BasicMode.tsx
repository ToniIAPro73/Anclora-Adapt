import React from "react";
import type { FC } from "react";
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
import { useBasicModeState } from "./useBasicModeState";
import BasicModeForm from "./BasicModeForm";

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

const BasicMode: FC<BasicModeProps> = ({
  onGenerate,
  onCopy,
  interfaceLanguage,
  copy,
  outputCopy,
  languageOptions,
}) => {
  // Use custom hook for local state management
  const {
    isLoading,
    error,
    outputs,
    setError,
    _imageUrl,
    _setImageUrl,
    idea,
    setIdea,
    language,
    setLanguage,
    tone,
    setTone,
    platforms,
    speed,
    literalTranslation,
    setLiteralTranslation,
    minChars,
    setMinChars,
    maxChars,
    setMaxChars,
    isMobile,
    uploadedFileName,
    uploadedText,
    fileInputRef,
    normalizedLanguageOptions,
    togglePlatform,
    handleFileUploadClick,
    handleFileSelected,
  } = useBasicModeState(interfaceLanguage, languageOptions);

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
      {/* Input Form Section */}
      <BasicModeForm
        idea={idea}
        onIdeaChange={setIdea}
        interfaceLanguage={interfaceLanguage}
        uploadLabel={copy.uploadLabel || "Importar texto"}
        uploadHint={copy.uploadHint}
        uploadedFileName={uploadedFileName}
        onFileUploadClick={handleFileUploadClick}
        fileInputRef={fileInputRef}
        onFileSelected={handleFileSelected}
        language={language}
        onLanguageChange={setLanguage}
        tone={tone}
        onToneChange={setTone}
        platforms={platforms}
        onTogglePlatform={togglePlatform}
        literalTranslation={literalTranslation}
        onToggleLiteral={setLiteralTranslation}
        minChars={minChars}
        onMinCharsChange={setMinChars}
        maxChars={maxChars}
        onMaxCharsChange={setMaxChars}
        languageOptions={normalizedLanguageOptions}
        isMobile={isMobile}
        isLoading={isLoading}
        buttonLabel={buttonLabel}
        onGenerate={handleGenerate}
      />

      {/* Output Display Section */}
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
