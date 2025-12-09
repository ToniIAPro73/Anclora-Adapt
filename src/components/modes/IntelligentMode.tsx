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
  languageCode,
  deepThinking,
  platformHints,
}: {
  idea: string;
  context: string;
  languageLabel: string;
  languageCode: string;
  deepThinking: boolean;
  platformHints: string[];
}): string => {
  const locale = languageCode?.startsWith("en") ? "en" : "es";
  const normalizedContext = context || (locale === "en" ? "General context" : "Contexto general");

  const ageMatch = normalizedContext.match(/(\d{2})\s*-\s*(\d{2})/);
  const ageDescriptor = ageMatch
    ? locale === "en"
      ? `${ageMatch[1]}-${ageMatch[2]} years old`
      : `${ageMatch[1]}-${ageMatch[2]} años`
    : locale === "en"
    ? "35-55 years old decision makers"
    : "35-55 años tomadores de decisión";

  const executiveAudience =
    /ceo|founder|emprendedor|entrepreneur|director/i.test(normalizedContext);
  const audienceRole = executiveAudience
    ? locale === "en"
      ? "founders, CEOs and serial entrepreneurs"
      : "fundadores, CEO y emprendedores seriales"
    : locale === "en"
    ? "business decision makers seeking premium advisory"
    : "decisores de negocio que buscan asesoría premium";

  const platformSentence =
    platformHints.length > 0
      ? locale === "en"
        ? `Priority platforms: ${platformHints.join(
            ", "
          )}. Adapt angle, pacing, CTA and creative assets to each format.`
        : `Plataformas prioritarias: ${platformHints.join(
            ", "
          )}. Ajusta ángulo, ritmo, CTA y recursos creativos a cada formato.`
      : locale === "en"
      ? "Select the most effective platform mix and justify how each channel reinforces the core story."
      : "Selecciona la mezcla de canales más efectiva y justifica cómo cada uno refuerza la narrativa.";

  const toneDescriptor = locale === "en"
    ? "premium, consultative, culturally bilingual, confident yet empathetic"
    : "premium, consultivo, bilingüe cultural, seguro pero empático";

  const keyMessages = locale === "en"
    ? [
        "Highlight bespoke advisory, deep knowledge of UAE regulations, and bilingual negotiation",
        "Contrast personal touch versus impersonal large firms",
        "Showcase credibility (success stories, certifications, network in Dubai/Abu Dhabi)",
      ]
    : [
        "Destaca el acompañamiento a medida, dominio regulatorio en EAU y capacidad de negociación bilingüe",
        "Contrasta el trato personal frente a firmas impersonales",
        "Refuerza credenciales (casos de éxito, certificaciones, red en Dubái/Abu Dabi)",
      ];

  const objectives = locale === "en"
    ? [
        "Position the advisor as the go-to Spanish-speaking expert for premium real estate moves in UAE",
        "Generate qualified leads via high-intent storytelling tailored to each social format",
        "Drive private consultations or discovery calls with affluent prospects",
      ]
    : [
        "Posicionar al asesor como referente hispanohablante para inversiones inmobiliarias premium en EAU",
        "Generar leads cualificados con relato de alto interés ajustado a cada formato social",
        "Impulsar sesiones privadas o llamadas exploratorias con prospectos de alto patrimonio",
      ];

  const restrictions = locale === "en"
    ? [
        "Avoid generic motivational clichés or empty luxury buzzwords",
        "Do not promise guaranteed returns; focus on strategic guidance",
        "Keep every platform output within its character and style constraints",
      ]
    : [
        "Evita clichés motivacionales genéricos o palabras vacías sobre lujo",
        "No prometas retornos garantizados; enfócate en la guía estratégica",
        "Mantén cada plataforma dentro de sus límites de estilo y caracteres",
      ];

  const kpis = locale === "en"
    ? [
        "Qualified leads captured per platform",
        "DMs or calls booked with affluent prospects",
        "Engagement rate lift on Stories/Reels compared to last month",
      ]
    : [
        "Leads cualificados captados por plataforma",
        "DM/calendly agendados con prospectos de alto patrimonio",
        "Incremento de engagement en Stories/Reels vs. mes anterior",
      ];

  const checklist = locale === "en"
    ? [
        "Does each platform have a clear hook, proof point, and CTA?",
        "Are cultural nuances for ES/LATAM audiences respected while referencing UAE context?",
        "Is there a differentiated angle versus large, impersonal competitors?",
      ]
    : [
        "¿Cada plataforma tiene gancho, prueba y CTA claros?",
        "¿Se respetan los matices culturales ES/LATAM al hablar de EAU?",
        "¿Se evidencia un ángulo distintivo frente a competidores impersonales?",
      ];

  const depthSentence =
    locale === "en"
      ? deepThinking
        ? "Deep thinking mode: map hidden objections (trust, legal risk, relocation stress), propose mitigation tactics and cascade ideas for short, mid and long term content."
        : "Standard mode: prioritize clarity, authority and fast execution."
      : deepThinking
      ? "Modo pensamiento profundo: mapea objeciones latentes (confianza, riesgo legal, estrés de reubicación), propone tácticas de mitigación e ideas a corto, mediano y largo plazo."
      : "Modo estándar: prioriza claridad, autoridad y velocidad de ejecución.";

  const platformCTA =
    locale === "en"
      ? `Primary CTA: "Schedule a private strategy call". Secondary CTA: "Download the UAE entry checklist" (Stories swipe-up or WhatsApp).`
      : `CTA principal: "Agenda una sesión estratégica privada". CTA secundario: "Descarga el checklist de entrada a EAU" (swipe-up en Stories o WhatsApp).`;

  const sections = [
    {
      title: locale === "en" ? "Role" : "Rol",
      content:
        locale === "en"
          ? `Act as a senior multilingual content strategist who writes in ${languageLabel}, blending strategic rigor with creative storytelling.`
          : `Actúa como estratega senior de contenido multimodal que redacta en ${languageLabel}, combinando rigor estratégico con narrativa creativa.`,
    },
    {
      title: locale === "en" ? "Context" : "Contexto",
      content: locale === "en"
        ? `Core mission: ${idea}. Context: ${normalizedContext}. ${platformSentence}`
        : `Misión central: ${idea}. Contexto: ${normalizedContext}. ${platformSentence}`,
    },
    {
      title: locale === "en" ? "Audience" : "Audiencia",
      content: locale === "en"
        ? `Segment: ${audienceRole}, ${ageDescriptor}. Needs: reliable partner to invest/relocate in UAE without losing cultural nuances or transparency.`
        : `Segmento: ${audienceRole}, ${ageDescriptor}. Necesidades: aliado confiable para invertir/reubicarse en EAU sin perder matices culturales ni transparencia.`,
    },
    {
      title: locale === "en" ? "Objectives" : "Objetivos",
      content: objectives.map((obj, index) => `${index + 1}) ${obj}`).join(" "),
    },
    {
      title: locale === "en" ? "Key Messages" : "Mensajes clave",
      content: keyMessages.map((msg, index) => `${index + 1}) ${msg}`).join(" "),
    },
    {
      title: locale === "en" ? "Tone & Style" : "Tono/Estilo",
      content:
        locale === "en"
          ? `${toneDescriptor}. Balance data-driven insight with aspirational storytelling.`
          : `${toneDescriptor}. Equilibra insight basado en datos con relato aspiracional.`,
    },
    {
      title: "CTA",
      content: platformCTA,
    },
    {
      title: locale === "en" ? "Restrictions" : "Restricciones",
      content: restrictions.map((item, index) => `${index + 1}) ${item}`).join(" "),
    },
    {
      title: "KPIs",
      content: kpis.map((kpi, index) => `${index + 1}) ${kpi}`).join(" "),
    },
    {
      title: locale === "en" ? "Checklist" : "Checklist",
      content: checklist.map((item, index) => `${index + 1}) ${item}`).join(" "),
    },
  ];

  return [
    sections
      .map((section, index) => `${index + 1}. ${section.title}: ${section.content}`)
      .join("\n\n"),
    depthSentence,
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
        languageCode: language,
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
