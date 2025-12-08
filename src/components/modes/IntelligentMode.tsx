import React from "react";
import type {
  InterfaceLanguage,
  AutoModelContext,
  ImageGenerationOptions,
} from "@/types";
import { languages } from "@/constants/options";
import type { LanguageOptionAvailability } from "@/constants/modelCapabilities";
import { structuredOutputExample } from "@/constants/prompts";
import commonStyles from "@/styles/commonStyles";
import { fileToBase64 } from "@/utils/files";
import OutputDisplay, {
  type OutputCopy,
} from "@/components/common/OutputDisplay";
import { useIntelligentModeState } from "./useIntelligentModeState";
import IntelligentModeForm from "./IntelligentModeForm";

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
  // Use custom hook for local state management
  const {
    isLoading,
    error,
    outputs,
    setError,
    imageUrl,
    setImageUrl,
    idea,
    setIdea,
    context,
    setContext,
    language,
    setLanguage,
    deepThinking,
    setDeepThinking,
    includeImage,
    setIncludeImage,
    imagePrompt,
    setImagePrompt,
    imageFile,
    imagePreview,
    isMobile,
    normalizedLanguageOptions,
    handleFileChange,
  } = useIntelligentModeState(interfaceLanguage, languageOptions);

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError(copy.errors.idea);
      return;
    }
    if (includeImage && !imagePrompt.trim()) {
      setError(copy.errors.imagePrompt);
      return;
    }
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
      {/* Input Form Section */}
      <IntelligentModeForm
        idea={idea}
        onIdeaChange={setIdea}
        interfaceLanguage={interfaceLanguage}
        context={context}
        onContextChange={setContext}
        language={language}
        onLanguageChange={setLanguage}
        deepThinking={deepThinking}
        onDeepThinkingChange={setDeepThinking}
        includeImage={includeImage}
        onIncludeImageChange={setIncludeImage}
        imagePrompt={imagePrompt}
        onImagePromptChange={setImagePrompt}
        imageFile={imageFile}
        imagePreview={imagePreview}
        onFileChange={handleFileChange}
        languageOptions={normalizedLanguageOptions}
        isMobile={isMobile}
        isLoading={isLoading}
        onGenerate={handleGenerate}
      />

      {/* Output Display Section */}
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
