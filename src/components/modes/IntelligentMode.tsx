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

interface IntelligentJSON {
  metadata: {
    version: string;
    timestamp: string;
    mode: "intelligent";
  };
  inputs: {
    idea: string;
    contexto: string;
    idioma: string;
    pensamiento_profundo: boolean;
    imagen_incluida: boolean;
    imagen_prompt?: string;
    imagen_analizada?: boolean;
  };
  resultados: {
    contenido_generado: string;
    imagen_url?: string;
  };
}

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
    generatedJSON,
    setGeneratedJSON,
    executedPrompt,
    setExecutedPrompt,
    improvePrompt,
    setImprovePrompt,
    isProcessing,
    setIsProcessing,
  } = useIntelligentModeState(interfaceLanguage, languageOptions);

  const downloadJSON = () => {
    if (!generatedJSON) return;

    const dataStr = JSON.stringify(generatedJSON, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inteligente.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPromptMarkdown = () => {
    if (!executedPrompt) return;

    const markdown = `# Prompt Ejecutado\n\n\`\`\`\n${executedPrompt}\n\`\`\``;
    const dataBlob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prompt.md";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError(copy.errors.idea);
      return;
    }
    // Si incluir imagen está marcado, el prompt de imagen es obligatorio
    if (includeImage && !imagePrompt.trim()) {
      setError(copy.errors.imagePrompt);
      return;
    }
    setIsProcessing(true);
    try {
      const languageDisplay =
        languages.find((l) => l.value === language)?.label || language;

      // Step 1: Build the raw prompt
      const rawPrompt = `Rol: Estratega. Tarea: "${idea}". Contexto: "${
        context || "General"
      }". Idioma: ${languageDisplay}.${
        includeImage && imagePrompt.trim()
          ? ` Prompt para imagen: "${imagePrompt}".`
          : ""
      }`;

      let finalPrompt = rawPrompt;

      // Step 2: If improvePrompt is checked, optimize the prompt using backend
      if (improvePrompt) {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
          const optimizeUrl = `${API_BASE_URL}/api/prompts/optimize`;
          const response = await fetch(optimizeUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: rawPrompt,
                deep_thinking: deepThinking,
                model: "qwen2.5:7b-instruct",
              }),
            }
          );

          if (!response.ok) {
            throw new Error(
              `Error optimizing prompt: ${response.statusText}`
            );
          }

          const optimizeResult = await response.json();
          if (optimizeResult.success && optimizeResult.improved_prompt) {
            finalPrompt = optimizeResult.improved_prompt;
          } else {
            // If optimization fails, use raw prompt and show warning
            const errorMsg = optimizeResult.error || "Error desconocido";
            console.warn("Prompt optimization failed, using raw prompt:", errorMsg);
            setError(`Aviso: No se pudo optimizar el prompt. Usando versión original.`);
          }
        } catch (optimizeErr) {
          // If backend is unavailable, use raw prompt with warning
          const errorMsg = optimizeErr instanceof Error ? optimizeErr.message : String(optimizeErr);
          console.warn("Prompt optimizer unavailable, using raw prompt:", errorMsg);
          // Continue with raw prompt instead of failing
        }
      }

      // Step 3: Save the final prompt for display and download
      setExecutedPrompt(finalPrompt);

      // Step 4: Generate image if needed
      let generatedImageUrl: string | undefined;
      if (includeImage && imagePrompt.trim()) {
        const base64 = imageFile ? await fileToBase64(imageFile) : undefined;
        const imageResult = await onGenerateImage({
          prompt: `${imagePrompt}\nContexto: ${context || "General"}`,
          base64Image: base64,
        });
        generatedImageUrl = imageResult;
        setImageUrl(imageResult);
      }

      // Step 5: Create JSON with the final prompt
      const intelligentJSON: IntelligentJSON = {
        metadata: {
          version: "1.0",
          timestamp: new Date().toISOString(),
          mode: "intelligent",
        },
        inputs: {
          idea,
          contexto: context || "General",
          idioma: languageDisplay,
          pensamiento_profundo: deepThinking,
          imagen_incluida: includeImage,
          ...(includeImage && { imagen_prompt: imagePrompt }),
          ...(includeImage && imageFile && { imagen_analizada: !!imageFile }),
        },
        resultados: {
          contenido_generado: finalPrompt,
          ...(generatedImageUrl && { imagen_url: generatedImageUrl }),
        },
      };

      setGeneratedJSON(intelligentJSON);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsProcessing(false);
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
        deepThinkingLabel={copy.deepThinkingLabel}
        improvePrompt={improvePrompt}
        onImprovePromptChange={setImprovePrompt}
        includeImage={includeImage}
        onIncludeImageChange={setIncludeImage}
        imagePrompt={imagePrompt}
        onImagePromptChange={setImagePrompt}
        imageFile={imageFile}
        imagePreview={imagePreview}
        onFileChange={handleFileChange}
        languageOptions={normalizedLanguageOptions}
        isMobile={isMobile}
        isLoading={isLoading || isProcessing}
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
            generatedJSON={generatedJSON}
            onDownloadJSON={downloadJSON}
            executedPrompt={executedPrompt}
            onDownloadPrompt={downloadPromptMarkdown}
          />
        </div>
      </div>
    </div>
  );
};

export default IntelligentMode;
