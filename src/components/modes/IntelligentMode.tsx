import React from "react";
import type {
  InterfaceLanguage,
  AutoModelContext,
  ImageGenerationOptions,
} from "@/types";
import { languages } from "@/constants/options";
import type { LanguageOptionAvailability } from "@/constants/modelCapabilities";
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

interface GeneratedJSON {
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
  };
  resultados: {
    prompt_idea: string;
    prompt_imagen?: string;
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
  onCopy: (text: string) => void;
  copy: IntelligentCopy;
  outputCopy: OutputCopy;
  onGenerateImage: GenerateImageFn;
  languageOptions: LanguageOptionAvailability[];
};

const IntelligentMode: React.FC<IntelligentModeProps> = ({
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
    improvePrompt,
    setImprovePrompt,
    isProcessing,
    setIsProcessing,
  } = useIntelligentModeState(interfaceLanguage, languageOptions);

  // Store separate prompts for display and download
  const [ideaPromptFinal, setIdeaPromptFinal] = React.useState<string | null>(null);
  const [imagePromptFinal, setImagePromptFinal] = React.useState<string | null>(null);

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


  const downloadIdeaPromptMarkdown = () => {
    if (!ideaPromptFinal) return;

    const markdown = `# Prompt para Idea/Contexto\n\n\`\`\`\n${ideaPromptFinal}\n\`\`\``;
    const dataBlob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prompt_idea.md";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadIdeaPromptJSON = () => {
    if (!ideaPromptFinal) return;

    const promptData = {
      metadata: {
        version: "1.0",
        timestamp: new Date().toISOString(),
        mode: "intelligent",
        type: "idea_prompt"
      },
      prompt: ideaPromptFinal,
      inputs: {
        idea,
        contexto: context || "General",
        idioma: languages.find((l) => l.value === language)?.label || language,
        pensamiento_profundo: deepThinking,
        mejorado: improvePrompt
      }
    };

    const dataStr = JSON.stringify(promptData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prompt_idea.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadImagePromptMarkdown = () => {
    if (!imagePromptFinal) return;

    const markdown = `# Prompt para Imagen\n\n\`\`\`\n${imagePromptFinal}\n\`\`\``;
    const dataBlob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prompt_imagen.md";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadImagePromptJSON = () => {
    if (!imagePromptFinal) return;

    const promptData = {
      metadata: {
        version: "1.0",
        timestamp: new Date().toISOString(),
        mode: "intelligent",
        type: "image_prompt"
      },
      prompt: imagePromptFinal,
      inputs: {
        imagen_prompt: imagePrompt,
        pensamiento_profundo: deepThinking,
        mejorado: improvePrompt
      }
    };

    const dataStr = JSON.stringify(promptData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prompt_imagen.json";
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

      // Sanitize inputs by removing newlines to prevent JSON parsing issues
      const sanitizeInput = (text: string) => text.replace(/\n/g, " ").replace(/\r/g, "").trim();

      // Helper function to optimize a prompt
      const optimizePromptViaBackend = async (rawPrompt: string): Promise<string> => {
        if (!improvePrompt) return rawPrompt;

        try {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
          const optimizeUrl = `${API_BASE_URL}/api/prompts/optimize`;
          const response = await fetch(optimizeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: rawPrompt,
              deep_thinking: deepThinking,
              language: language,
              // No especificamos modelo - el backend usa el mejor disponible (mistral > qwen2.5:14b)
            }),
          });

          if (!response.ok) {
            throw new Error(`Error optimizing prompt: ${response.statusText}`);
          }

          const optimizeResult = await response.json();
          if (optimizeResult.success && optimizeResult.improved_prompt) {
            return optimizeResult.improved_prompt;
          } else {
            const errorMsg = optimizeResult.error || "Error desconocido";
            console.warn("Prompt optimization failed, using raw prompt:", errorMsg);
            setError(`Aviso: No se pudo optimizar el prompt. Usando versión original.`);
            return rawPrompt;
          }
        } catch (optimizeErr) {
          const errorMsg = optimizeErr instanceof Error ? optimizeErr.message : String(optimizeErr);
          console.warn("Prompt optimizer unavailable, using raw prompt:", errorMsg);
          return rawPrompt;
        }
      };

      // PROMPT 1: Idea/Context Prompt
      const ideaPromptRaw = `Rol: Estratega. Tarea: "${sanitizeInput(idea)}". Contexto: "${
        sanitizeInput(context) || "General"
      }". Idioma: ${languageDisplay}.`;

      const ideaPromptFinalValue = await optimizePromptViaBackend(ideaPromptRaw);
      setIdeaPromptFinal(ideaPromptFinalValue);

      // PROMPT 2: Image Prompt (if included)
      let imagePromptFinalValue: string | undefined;
      let generatedImageUrl: string | undefined;

      if (includeImage && imagePrompt.trim()) {
        const imagePromptRaw = sanitizeInput(imagePrompt);
        imagePromptFinalValue = await optimizePromptViaBackend(imagePromptRaw);
        setImagePromptFinal(imagePromptFinalValue);

        // Generate image with the optimized prompt
        // Suppress image generation errors silently since image generation is not implemented
        try {
          const base64 = imageFile ? await fileToBase64(imageFile) : undefined;
          const imageResult = await onGenerateImage({
            prompt: imagePromptFinalValue,
            base64Image: base64,
          });
          generatedImageUrl = imageResult;
          setImageUrl(imageResult);
        } catch (imageErr) {
          // Silently ignore image generation errors - user knows this is not implemented
          console.warn("Image generation not available:", imageErr instanceof Error ? imageErr.message : String(imageErr));
        }
      } else {
        setImagePromptFinal(null);
      }

      // Store both prompts for download
      const generatedData: GeneratedJSON = {
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
          ...(includeImage && { imagen_prompt: imagePromptFinalValue }),
        },
        resultados: {
          prompt_idea: ideaPromptFinalValue,
          ...(imagePromptFinalValue && { prompt_imagen: imagePromptFinalValue }),
          ...(generatedImageUrl && { imagen_url: generatedImageUrl }),
        },
      };
      setGeneratedJSON(generatedData);
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
            ideaPrompt={ideaPromptFinal}
            imagePrompt={imagePromptFinal}
            onDownloadIdeaPrompt={downloadIdeaPromptMarkdown}
            onDownloadIdeaPromptJSON={downloadIdeaPromptJSON}
            onDownloadImagePrompt={downloadImagePromptMarkdown}
            onDownloadImagePromptJSON={downloadImagePromptJSON}
          />
        </div>
      </div>
    </div>
  );
};

export default IntelligentMode;
