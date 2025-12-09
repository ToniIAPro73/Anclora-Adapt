import React from "react";
import type {
  InterfaceLanguage,
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

const PLATFORM_HINTS = [
  { regex: /instagram|reels|stories/i, label: "Instagram (Stories/Reels)" },
  { regex: /linkedin/i, label: "LinkedIn" },
  { regex: /\b(x|twitter)\b/i, label: "X / Twitter" },
  { regex: /whatsapp/i, label: "WhatsApp" },
  { regex: /email|newsletter/i, label: "Email Marketing" },
  { regex: /youtube|video|shorts/i, label: "YouTube" },
  { regex: /podcast/i, label: "Podcast" },
  { regex: /tiktok/i, label: "TikTok" },
];

const detectPlatformHints = (text: string): string[] => {
  if (!text) return [];
  return PLATFORM_HINTS.filter(({ regex }) => regex.test(text)).map(
    ({ label }) => label
  );
};

const buildIdeaPromptFallback = ({
  idea,
  context,
  languageLabel,
  deepThinking,
  platformHints,
}: {
  idea: string;
  context: string;
  languageLabel: string;
  deepThinking: boolean;
  platformHints: string[];
}): string => {
  const platformSentence = platformHints.length
    ? `Plataformas prioritarias: ${platformHints.join(
        ", "
      )}. Ajusta narrativa, ritmo, formato y CTA para cada una.`
    : "Elige la mezcla de plataformas más efectiva y justifica brevemente por qué potencian el mensaje.";
  const depthDirective = deepThinking
    ? "Modo pensamiento profundo activo: analiza riesgos reputacionales, objeciones latentes, dependencias operativas y oportunidades de co-creación. Propón ideas accionables a corto, medio y largo plazo."
    : "Modo estándar: prioriza claridad estratégica, foco en diferenciación y velocidad de ejecución.";

  return [
    `Rol: actúa como estratega senior de contenido multimodal que escribe instrucciones en ${languageLabel}.`,
    `Objetivo central del cliente: ${idea}.`,
    `Contexto ampliado: ${context}. ${platformSentence}`,
    "Define la audiencia ideal (demografía + psicografía), el tono que genere confianza premium y los pain points que deben resolverse para posicionar al asesor como referente.",
    "Entregable obligatorio: redacta un prompt maestro listo para un LLM que incluya misión, enfoque narrativo, estructura sugerida por plataforma, propuestas de valor, CTA principal/secundario, diferenciadores competitivos y métricas de éxito.",
    "Incluye también: lista de ideas de apoyo, ángulos creativos alternos, hashtags o etiquetas sugeridas (si aplican) y bloque de errores a evitar.",
    depthDirective,
    'Formato final: usa secciones numeradas "Rol", "Contexto", "Audiencia", "Objetivos", "Mensajes clave", "Tono/Estilo", "CTA", "Restricciones", "KPIs" y "Checklist". Devuelve únicamente el prompt final listo para copiar/pegar.',
  ].join("\n\n");
};

const buildImagePromptFallback = ({
  description,
  languageLabel,
  deepThinking,
}: {
  description: string;
  languageLabel: string;
  deepThinking: boolean;
}): string => {
  const depthDirective = deepThinking
    ? "Describe microdetalles, simbolismos, capas narrativas y contrastes de materiales para reforzar la historia visual."
    : "Mantén la descripción con lenguaje claro pero específico para evitar ambigüedades.";

  return [
    `Prompt maestro para generador de imágenes (${languageLabel}).`,
    `Escena deseada: ${description}.`,
    "Detalla composición (punto de vista, distancia focal, distribución de planos), elementos principales/secundarios y narrativa implícita.",
    "Especifica iluminación (tipo, intensidad, temperatura), paleta cromática predominante con acentos, texturas y materiales dominantes.",
    "Añade parámetros técnicos: formato final, tipo de lente/cámara, nivel de realismo, calidad (8K, ultra-detailed) y motores/filtros sugeridos.",
    depthDirective,
    "Devuelve un único prompt continuo listo para usar en Stable Diffusion / Midjourney.",
  ].join("\n\n");
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
    setError(null);
    setIsProcessing(true);
    try {
      const languageDisplay =
        languages.find((l) => l.value === language)?.label || language;

      // Sanitize inputs by removing newlines to prevent JSON parsing issues
      const sanitizeInput = (text: string) =>
        text.replace(/\n/g, " ").replace(/\r/g, "").trim();
      const sanitizedIdea = sanitizeInput(idea);
      const sanitizedContext = sanitizeInput(context);
      const normalizedContext = sanitizedContext || "General";
      const platformHints = detectPlatformHints(
        `${sanitizedIdea} ${normalizedContext}`
      );

      // Helper function to optimize a prompt
      const optimizePromptViaBackend = async (
        rawPrompt: string,
        fallbackPrompt: string,
        options?: { returnRawWhenBypassed?: boolean }
      ): Promise<string> => {
        if (!improvePrompt) {
          return options?.returnRawWhenBypassed ? rawPrompt : fallbackPrompt;
        }

        try {
          const API_BASE_URL =
            import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
          const optimizeUrl = `${API_BASE_URL}/api/prompts/optimize`;
          const response = await fetch(optimizeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: rawPrompt,
              deep_thinking: deepThinking,
              language: language,
            }),
          });

          if (!response.ok) {
            throw new Error(`Error optimizing prompt: ${response.statusText}`);
          }

          const optimizeResult = await response.json();
          if (optimizeResult.success && optimizeResult.improved_prompt) {
            return optimizeResult.improved_prompt;
          }

          const errorMsg = optimizeResult.error || "Error desconocido";
          console.warn("Prompt optimization failed, using fallback prompt:", errorMsg);
          setError("Aviso: No se pudo optimizar el prompt. Usando versión original.");
          return fallbackPrompt;
        } catch (optimizeErr) {
          const errorMsg = optimizeErr instanceof Error ? optimizeErr.message : String(optimizeErr);
          console.warn("Prompt optimizer unavailable, using fallback prompt:", errorMsg);
          setError("Aviso: No se pudo optimizar el prompt. Usando versión original.");
          return fallbackPrompt;
        }
      };

      // PROMPT 1: Idea/Context Prompt
      const deepThinkingDirective = deepThinking
        ? "Aplica pensamiento profundo: identifica público objetivo, objetivos de negocio, riesgos y oportunidades latentes, dependencias y tono adecuado."
        : "Mantén claridad y foco sin extenderte innecesariamente.";
      const improvementDirective = improvePrompt
        ? "Optimiza el prompt para máxima claridad, pasos accionables y coherencia narrativa."
        : "";

      const ideaPromptRaw = [
        "Rol: Estratega senior de contenido multimodal.",
        `Objetivo principal: "${sanitizedIdea}".`,
        `Contexto adicional: "${normalizedContext}".`,
        `Idioma de salida: ${languageDisplay}.`,
        deepThinkingDirective,
        improvementDirective,
        "Devuelve un único prompt listo para LLM que combine mensaje clave, tono, formato sugerido, CTA y puntos diferenciales, evitando ambigüedad."
      ]
        .filter(Boolean)
        .join(" ");

      const ideaPromptFallback = buildIdeaPromptFallback({
        idea: sanitizedIdea,
        context: normalizedContext,
        languageLabel: languageDisplay,
        deepThinking,
        platformHints,
      });

      const ideaPromptFinalValue = await optimizePromptViaBackend(
        ideaPromptRaw,
        ideaPromptFallback
      );
      setIdeaPromptFinal(ideaPromptFinalValue);

      // PROMPT 2: Image Prompt (if included)
      let imagePromptFinalValue: string | undefined;
      let generatedImageUrl: string | undefined;

      if (includeImage && imagePrompt.trim()) {
        const sanitizedImagePrompt = sanitizeInput(imagePrompt);
        const imagePromptRaw = [
          sanitizedImagePrompt,
          deepThinking
            ? "Detalla composición, iluminación, óptica/cámara, materiales y atmósfera para recrear fielmente la escena."
            : "",
          improvePrompt
            ? "Optimiza para estabilidad en modelos de difusión, con descriptores de calidad y nivel de detalle alto."
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        const imagePromptFallback = buildImagePromptFallback({
          description: sanitizedImagePrompt,
          languageLabel: languageDisplay,
          deepThinking,
        });
        imagePromptFinalValue = await optimizePromptViaBackend(
          imagePromptRaw,
          imagePromptFallback,
          { returnRawWhenBypassed: true }
        );
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
