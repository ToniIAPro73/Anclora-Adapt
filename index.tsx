import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type, Modality, Chat, LiveServerMessage } from "@google/genai";

const API_KEY = process.env.API_KEY;

// Define la interfaz Blob localmente para el tipo de objeto que createBlob retorna.
interface Blob {
  data: string;
  mimeType: string;
}

// Utility functions for audio encoding/decoding
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Utility for image to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result?.toString().split(',')[1];
      if (base64String) {
        resolve(base64String);
      } else {
        reject(new Error("Failed to convert file to base64."));
      }
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};


interface GeneratedOutput {
  platform: string;
  content: string;
}

// New interface for OutputDisplay specific props
interface OutputDisplayProps {
  isLoading: boolean;
  error: string | null;
  onCopy: (text: string) => void;
  generatedOutputs?: GeneratedOutput[] | null;
  generatedImageUrl?: string | null;
  audioUrl?: string | null;
}

interface CommonProps {
  isLoading: boolean;
  error: string | null;
  generatedOutputs: GeneratedOutput[] | null;
  onGenerate: (prompt: string, schema: any, model?: string, config?: Record<string, any>) => Promise<void>;
  onCopy: (text: string) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setGeneratedImageUrl: React.Dispatch<React.SetStateAction<string | null>>; // Function to update image URL
}

// i18n translations
const i18n = {
  es: {
    appTitle: "AncloraAdapt",
    appSubtitle: "Traduce, adapta y reescribe con estilo e intención.",
    helpButton: "?",
    basicTab: "Básico",
    intelligentTab: "Inteligente",
    campaignTab: "Campaña",
    recycleTab: "Reciclar",
    chatTab: "Chat",
    ttsTab: "Voz",
    liveChatTab: "Live Chat",
    imageEditTab: "Imagen",
    loadingText: "La IA está trabajando en tu contenido. Esto puede tardar unos segundos...",
    generalError: "Error general: %s. Por favor, inténtalo de nuevo.",
    unexpectedResponseFormat: "Formato de respuesta inesperado de la IA. Por favor, inténtalo de nuevo.",
    copyButton: "Copiar",
    downloadAudio: "Descargar Audio",
    downloadImage: "Descargar Imagen",
    generatedAudioTitle: "Audio Generado:",
    generatedImageTitle: "Imagen Generada/Editada:",
    resultsAdaptedTitle: "Resultados Adaptados:",
    apiKeyNotFound: "Clave API no encontrada. Asegúrate de que process.env.API_KEY esté configurado.",

    // Basic Mode
    basicModeTitle: "Generador Multiformato",
    basicModeDesc: "Ideal para generar contenido adaptado a plataformas específicas, tonos e idiomas. Define tu idea, selecciona las opciones y obtén publicaciones listas para usar.",
    mainIdeaLabel: "Tu idea principal:",
    mainIdeaPlaceholder: "Escribe o di lo que quieres comunicar (ej. 'Quiero contar que lanzamos un nuevo ebook gratuito sobre productividad')",
    voiceInputSoon: "Voz (próximamente)",
    outputLanguageLabel: "Idioma de Salida:",
    detectLanguage: "Detectar automáticamente",
    toneLabel: "Tono:",
    detectTone: "Detectar automáticamente",
    platformsLabel: "Plataformas:",
    responseSpeedLabel: "Velocidad de Respuesta:",
    normalSpeed: "Normal (gemini-2.5-flash)",
    fastSpeed: "Rápida (gemini-2.5-flash-lite)",
    generateContentButton: "Generar Contenido",
    generating: "Generando...",
    errorEmptyInput: "Por favor, escribe lo que quieres comunicar.",
    errorNoPlatformSelected: "Por favor, selecciona al menos una plataforma.",

    // Intelligent Mode
    intelligentModeTitle: "Dime lo que quieres y yo lo adapto",
    intelligentModeDesc: "Escribe tu idea o necesidad en lenguaje natural, sin preocuparte por el formato o el destino. La IA lo interpretará y generará el contenido más adecuado.",
    conversationalMessageLabel: "Tu mensaje conversacional:",
    conversationalMessagePlaceholder: "Ej: 'Necesito una forma creativa de anunciar que he vuelto a publicar artículos en Medium, y que la gente se suscriba a mi newsletter. En tono amistoso y motivador. Para X y LinkedIn.'",
    deepThinkingCheckbox: "Pensamiento Profundo (gemini-2.5-pro)",
    deepThinkingHint: "(Para consultas complejas, mayor latencia)",
    includeImageCheckbox: "Incluir/Editar Imagen",
    includeImageHint: "(Genera o edita una imagen para tu contenido)",
    imageConfigTitle: "Configuración de Imagen:",
    generateNewImageRadio: "Generar nueva imagen",
    editExistingImageRadio: "Editar imagen existente",
    uploadImageLabel: "Sube tu imagen:",
    imagePreview: "Previsualización:",
    imagePromptLabel: "Prompt de Imagen:",
    imagePromptGeneratePlaceholder: "Ej: 'Un robot con una patineta roja en un estilo futurista'",
    imagePromptEditPlaceholder: "Ej: 'Añade un filtro retro', 'Quita a la persona del fondo', 'Haz el cielo más azul'",
    interpretAndGenerateButton: "Interpretar y Generar Contenido",
    interpretingAndGenerating: "Interpretando y Generando...",
    errorImageEditNoFile: "Por favor, sube una imagen para editar.",
    errorImagePromptEmpty: "Por favor, introduce un prompt para la imagen.",
    errorNoImageReceived: "No se recibió imagen de la IA. Inténtalo de nuevo.",
    errorGeneratingSmartContentOrImage: "Error al generar contenido inteligente o imagen:",

    // Campaign Mode
    campaignModeTitle: "Multiplica tu mensaje",
    campaignModeDesc: "Una idea, múltiples textos coordinados para una campaña express. La IA generará contenido adaptado a las principales plataformas de comunicación.",
    campaignIdeaLabel: "Idea principal de tu campaña:",
    campaignIdeaPlaceholder: "Ej: 'Quiero promocionar mi nuevo curso de IA con un enfoque inspirador, dirigido a marketers digitales'",
    campaignPlatformsLabel: "Plataformas de Campaña:",
    campaignDeepThinkingHint: "(Para estrategias complejas, mayor latencia)",
    campaignIncludeImageHint: "(Genera o edita una imagen para tu campaña)",
    campaignImagePromptGeneratePlaceholder: "Ej: 'Un logo inspirador para un curso de IA para marketers'",
    campaignImagePromptEditPlaceholder: "Ej: 'Cambia el fondo a un entorno de oficina moderno'",
    generateCampaignButton: "Generar Campaña Coordinada",
    creatingCampaign: "Creando Campaña...",
    errorEmptyCampaignIdea: "Por favor, escribe la idea principal de tu campaña.",
    errorGeneratingCampaignOrImage: "Error al generar campaña o imagen:",

    // Recycle Mode
    recycleModeTitle: "Sistema de Reciclaje de Contenidos",
    recycleModeDesc: "Transforma contenido existente en nuevos formatos, idiomas o tonos para maximizar su alcance y utilidad.",
    existingContentLabel: "Pega aquí tu contenido existente:",
    existingContentPlaceholder: "Pega un artículo, post de blog, email, o cualquier texto que quieras reciclar.",
    recycleOptionLabel: "Tipo de Reciclaje:",
    summaryRecycle: "Resumen conciso",
    xThreadRecycle: "Hilo para X (Twitter)",
    instagramCaptionRecycle: "Caption para Instagram",
    titleHookRecycle: "Título y Hook persuasivo",
    keyPointsRecycle: "Puntos clave",
    emailLaunchRecycle: "Email de lanzamiento",
    pressReleaseRecycle: "Nota de prensa",
    recycleButton: "Reciclar Contenido",
    recycling: "Reciclando Contenido...",
    errorEmptyContentToRecycle: "Por favor, pega el contenido que quieres reciclar.",

    // Chat Mode
    chatModeTitle: "Chat con AncloraAI",
    chatModeDesc: "Haz preguntas sobre creación de contenido, estrategias, o cualquier cosa que AncloraAdapt pueda ayudarte a lograr.",
    chatEmptyMessage: "Escribe tu primera pregunta para AncloraAI...",
    chatWriting: "Escribiendo...",
    chatInputPlaceholder: "Escribe tu mensaje...",
    chatSendButton: "Enviar",
    chatErrorInit: "El chat no está inicializado. Intenta recargar.",
    chatErrorResponse: "Error al obtener respuesta de la IA:",

    // TTS Mode
    ttsModeTitle: "Generar Voz (Texto a Voz)",
    ttsModeDesc: "Transforma tu texto en audio. Selecciona el idioma y la voz, y la IA traducirá y leerá el texto.",
    textToSpeakLabel: "Texto para convertir a voz:",
    textToSpeakPlaceholder: "Ej: 'Hola, soy AncloraAdapt. ¿En qué puedo ayudarte hoy?'",
    voiceLanguageLabel: "Idioma de la Voz:",
    voiceLabel: "Voz:",
    noVoicesAvailable: "No hay voces disponibles",
    generateSpeechButton: "Generar Voz",
    generatingSpeech: "Generando Voz...",
    errorEmptyTextToSpeak: "Por favor, escribe el texto que quieres convertir a voz.",
    errorNoLangOrVoiceSelected: "Por favor, selecciona un idioma y una voz.",
    errorTranslationFailed: "La traducción no produjo ningún texto. Inténtalo de nuevo.",
    errorNoAudioReceived: "No se recibió audio de la IA. Inténtalo de nuevo.",
    errorGeneratingSpeech: "Error al generar voz:",

    // Live Chat Mode
    liveChatTitle: "Conversación Live (Beta)",
    liveChatDesc: "Ten una conversación en tiempo real con Gemini. Habla con la IA y recibe respuestas de voz al instante.",
    liveChatWarning: "Importante: La API Live requiere una clave API y puede incurrir en costos de facturación. Asegúrate de tener la facturación habilitada en tu proyecto de Google Cloud.",
    billingInfo: "Más información sobre facturación",
    selectApiKey: "Seleccionar Clave API",
    apiKeyErrorChecking: "Error al verificar la clave API. Por favor, inténtalo de nuevo.",
    apiKeyErrorSelection: "Error al abrir el selector de clave API. Inténtalo de nuevo.",
    apiKeyRequiredMessage: "Por favor, selecciona tu clave API para usar la conversación en vivo. Puedes necesitar habilitar la facturación para Gemini Live API.",
    apiKeyBillingError: "Error de clave API o facturación. Por favor, verifica tu clave API y la configuración de facturación.",
    startConversation: "Iniciar Conversación",
    stopConversation: "Detener Conversación",
    errorLiveSession: "Error en la sesión en vivo: %s. Intenta reiniciar.",
    errorStartRecording: "No se pudo iniciar la grabación: %s. Asegúrate de que el micrófono esté permitido.",
    liveTranscriptEmpty: "Inicia una conversación para ver la transcripción en tiempo real.",
    liveUserPrefix: "Usuario: ",
    liveAIPrefix: "AI: ",

    // Image Edit Mode
    imageEditModeTitle: "Edición y Generación de Imagen con IA",
    imageEditModeDesc: "Sube una imagen y usa prompts de texto para editarla con Gemini 2.5 Flash Image o, directamente, explica a la IA qué imagen quieres generar.",
    uploadImageOrGenerate: "Sube tu imagen (opcional para generación, necesario para edición):",
    imagePromptEditGenerateLabel: "Prompt de Imagen (Generación o Edición):",
    imagePromptEditGeneratePlaceholder: "Ej: 'Un robot con una patineta roja en un estilo futurista' (para generar) o 'Añade un filtro retro' (para editar)",
    editGenerateImageButton: "Editar/Generar Imagen",
    processingImage: "Procesando Imagen...",
    errorGeneratingOrEditingImage: "Error al editar/generar imagen: %s. Asegúrate de que el prompt sea claro.",

    // Tutorial
    tutorialNext: "Siguiente",
    tutorialPrev: "Anterior",
    tutorialClose: "Cerrar tutorial",
    tutorialStepCount: "Paso %d de %d",
    tutorialTitleWelcome: "Bienvenido a AncloraAdapt",
    tutorialDescWelcome: "Esta guía te ayudará a descubrir cómo transformar y potenciar tu contenido con IA. ¡Vamos a explorar sus modos principales!",
    tutorialTitleBasic: "Modo Básico: Generador Multiformato",
    tutorialDescBasic: "Ideal para generar contenido adaptado a plataformas específicas, tonos e idiomas. Define tu idea, selecciona las opciones y obtén publicaciones listas para usar.",
    tutorialTitleIntelligent: "Modo Inteligente: 'Dime lo que quieres y yo lo adapto'",
    tutorialDescIntelligent: "Describe tu necesidad en lenguaje natural y deja que la IA infiera el mejor contenido, tono y plataformas. Incluso puedes optar por generar o editar imágenes para complementar tu mensaje.",
    tutorialTitleCampaign: "Modo Campaña: 'Multiplica tu mensaje'",
    tutorialDescCampaign: "Crea campañas de marketing coordinadas para múltiples plataformas desde una única idea. La IA adaptará cada mensaje y Call To Action (CTA), y podrás añadir imágenes si lo deseas.",
    tutorialTitleRecycle: "Modo Reciclar de Contenidos",
    tutorialDescRecycle: "Reutiliza contenido existente transformándolo en nuevos formatos como resúmenes, hilos para X, captions de Instagram o títulos persuasivos. ¡Maximiza la vida útil de tu contenido!",
    tutorialTitleChat: "Modo Chat con AncloraAI",
    tutorialDescChat: "Conversa con AncloraAI para obtener ayuda contextual y sugerencias sobre creación y adaptación de contenido. Un asistente siempre a tu disposición para resolver tus dudas.",
    tutorialTitleTTS: "Modo Voz: Texto a Voz",
    tutorialDescTTS: "Convierte texto en audio con voces de IA. Selecciona el idioma de la voz y la IA traducirá automáticamente el texto original a ese idioma antes de generarlo en audio.",
    tutorialTitleLiveChat: "Modo Live Chat: Conversación en Tiempo Real",
    tutorialDescLiveChat: "Experimenta una conversación bidireccional en tiempo real con Gemini. Habla con la IA y recibe respuestas de voz al instante. Requiere una clave API configurada y puede incurrir en costos de facturación.",
    tutorialTitleImage: "Modo Imagen: Edición y Generación Visual",
    tutorialDescImage: "Sube una imagen y usa prompts de texto para editarla con Gemini 2.5 Flash Image o, directamente, explica a la IA qué imagen quieres generar.",
    tutorialTitleReady: "¡Estás listo para empezar!",
    tutorialDescReady: "Hemos cubierto las funcionalidades principales de AncloraAdapt. ¡Ahora explora cada modo y potencia tu comunicación como nunca!",

    // Language/Tones/Platforms (labels)
    lang_detect: 'Detectar automáticamente',
    lang_es: 'Español',
    lang_en: 'English',
    lang_fr: 'Français',
    lang_de: 'Deutsch',
    lang_pt: 'Português',
    lang_it: 'Italiano',
    lang_zh: 'Chino',
    lang_ja: 'Japonés',
    lang_ru: 'Ruso',
    lang_ar: 'Árabe',

    tone_detect: 'Detectar automáticamente',
    tone_Profesional: 'Profesional',
    tone_Amistoso: 'Amistoso',
    tone_Formal: 'Formal',
    tone_Casual: 'Casual',
    tone_Motivador: 'Motivador',
    tone_Emocional: 'Emocional',
    tone_Directo: 'Directo',
    tone_Creativo: 'Creativo',

    platform_LinkedIn: 'LinkedIn',
    platform_X: 'X (Twitter)',
    platform_Instagram: 'Instagram',
    platform_WhatsApp: 'WhatsApp',
    platform_Email: 'Email',
    platform_Web: 'Web (Blog/Artículo)',

    // TTS Voices (labels)
    voice_Kore_es: 'Kore (Femenina) - español neutral',
    voice_Charon_es: 'Charon (Masculina) - español neutral',
    voice_Zephyr_en: 'Zephyr (Female) - English (US)',
    voice_Puck_en: 'Puck (Male) - English (US)',
    voice_Kore_fr: 'Kore (Féminine) - Français',
    voice_Charon_fr: 'Charon (Masculin) - Français',
    voice_Zephyr_de: 'Zephyr (Weiblich) - Deutsch',
    voice_Puck_de: 'Puck (Männlich) - Deutsch',
    voice_Kore_pt: 'Kore (Feminina) - Português',
    voice_Charon_pt: 'Charon (Masculino) - Português',
    voice_Zephyr_it: 'Zephyr (Femminile) - Italiano',
    voice_Puck_it: 'Puck (Maschile) - Italiano',
    voice_Kore_zh: 'Kore (女性) - 中文',
    voice_Charon_zh: 'Charon (男性) - 中文',
    voice_Zephyr_ja: 'Zephyr (女性) - 日本語',
    voice_Puck_ja: 'Puck (男性) - 日本語',
    voice_Kore_ru: 'Kore (Женский) - Русский',
    voice_Charon_ru: 'Charon (Мужской) - Русский',
    voice_Zephyr_ar: 'Zephyr (أنثى) - العربية',
    voice_Puck_ar: 'Puck (ذكر) - العربية',
  },
  en: {
    appTitle: "AncloraAdapt",
    appSubtitle: "Translate, adapt, and rewrite with style and intent.",
    helpButton: "?",
    basicTab: "Basic",
    intelligentTab: "Intelligent",
    campaignTab: "Campaign",
    recycleTab: "Recycle",
    chatTab: "Chat",
    ttsTab: "Voice",
    liveChatTab: "Live Chat",
    imageEditTab: "Image",
    loadingText: "AI is working on your content. This may take a few seconds...",
    generalError: "General error: %s. Please try again.",
    unexpectedResponseFormat: "Unexpected response format from AI. Please try again.",
    copyButton: "Copy",
    downloadAudio: "Download Audio",
    downloadImage: "Download Image",
    generatedAudioTitle: "Generated Audio:",
    generatedImageTitle: "Generated/Edited Image:",
    resultsAdaptedTitle: "Adapted Results:",
    apiKeyNotFound: "API Key not found. Please ensure process.env.API_KEY is configured.",

    // Basic Mode
    basicModeTitle: "Multiformat Generator",
    basicModeDesc: "Ideal for generating content adapted to specific platforms, tones, and languages. Define your idea, select the options, and get ready-to-use posts.",
    mainIdeaLabel: "Your main idea:",
    mainIdeaPlaceholder: "Write or say what you want to communicate (e.g., 'I want to announce that we've launched a new free ebook on productivity')",
    voiceInputSoon: "Voice (coming soon)",
    outputLanguageLabel: "Output Language:",
    detectLanguage: "Auto-detect",
    toneLabel: "Tone:",
    detectTone: "Auto-detect",
    platformsLabel: "Platforms:",
    responseSpeedLabel: "Response Speed:",
    normalSpeed: "Normal (gemini-2.5-flash)",
    fastSpeed: "Fast (gemini-2.5-flash-lite)",
    generateContentButton: "Generate Content",
    generating: "Generating...",
    errorEmptyInput: "Please write what you want to communicate.",
    errorNoPlatformSelected: "Please select at least one platform.",

    // Intelligent Mode
    intelligentModeTitle: "Tell me what you want and I'll adapt it",
    intelligentModeDesc: "Write your idea or need in natural language, without worrying about format or destination. The AI will interpret it and generate the most suitable content.",
    conversationalMessageLabel: "Your conversational message:",
    conversationalMessagePlaceholder: "E.g.: 'I need a creative way to announce that I've started publishing articles on Medium again, and that people should subscribe to my newsletter. In a friendly and motivating tone. For X and LinkedIn.'",
    deepThinkingCheckbox: "Deep Thinking (gemini-2.5-pro)",
    deepThinkingHint: "(For complex queries, higher latency)",
    includeImageCheckbox: "Include/Edit Image",
    includeImageHint: "(Generate or edit an image for your content)",
    imageConfigTitle: "Image Configuration:",
    generateNewImageRadio: "Generate new image",
    editExistingImageRadio: "Edit existing image",
    uploadImageLabel: "Upload your image:",
    imagePreview: "Preview:",
    imagePromptLabel: "Image Prompt:",
    imagePromptGeneratePlaceholder: "E.g.: 'A robot with a red skateboard in a futuristic style'",
    imagePromptEditPlaceholder: "E.g.: 'Add a retro filter', 'Remove the person in the background', 'Make the sky bluer'",
    interpretAndGenerateButton: "Interpret and Generate Content",
    interpretingAndGenerating: "Interpreting and Generating...",
    errorImageEditNoFile: "Please upload an image to edit.",
    errorImagePromptEmpty: "Please enter a prompt for the image.",
    errorNoImageReceived: "No image received from AI. Please try again.",
    errorGeneratingSmartContentOrImage: "Error generating smart content or image:",

    // Campaign Mode
    campaignModeTitle: "Multiply your message",
    campaignModeDesc: "One idea, multiple coordinated texts for an express campaign. The AI will generate content adapted to the main communication platforms.",
    campaignIdeaLabel: "Main idea of your campaign:",
    campaignIdeaPlaceholder: "E.g.: 'I want to promote my new AI course with an inspiring approach, aimed at digital marketers'",
    campaignPlatformsLabel: "Campaign Platforms:",
    campaignDeepThinkingHint: "(For complex strategies, higher latency)",
    campaignIncludeImageHint: "(Generate or edit an image for your campaign)",
    campaignImagePromptGeneratePlaceholder: "E.g.: 'An inspiring logo for an AI course for marketers'",
    campaignImagePromptEditPlaceholder: "E.g.: 'Change the background to a modern office environment'",
    generateCampaignButton: "Generate Coordinated Campaign",
    creatingCampaign: "Creating Campaign...",
    errorEmptyCampaignIdea: "Please write the main idea of your campaign.",
    errorGeneratingCampaignOrImage: "Error generating campaign or image:",

    // Recycle Mode
    recycleModeTitle: "Content Recycling System",
    recycleModeDesc: "Transform existing content into new formats, languages, or tones to maximize its reach and utility.",
    existingContentLabel: "Paste your existing content here:",
    existingContentPlaceholder: "Paste an article, blog post, email, or any text you want to recycle.",
    recycleOptionLabel: "Recycling Type:",
    summaryRecycle: "Concise summary",
    xThreadRecycle: "Thread for X (Twitter)",
    instagramCaptionRecycle: "Caption for Instagram",
    titleHookRecycle: "Persuasive Title and Hook",
    keyPointsRecycle: "Key points",
    emailLaunchRecycle: "Launch email",
    pressReleaseRecycle: "Press release",
    recycleButton: "Recycle Content",
    recycling: "Recycling Content...",
    errorEmptyContentToRecycle: "Please paste the content you want to recycle.",

    // Chat Mode
    chatModeTitle: "Chat with AncloraAI",
    chatModeDesc: "Ask questions about content creation, strategies, or anything AncloraAdapt can help you achieve.",
    chatEmptyMessage: "Write your first question for AncloraAI...",
    chatWriting: "Writing...",
    chatInputPlaceholder: "Write your message...",
    chatSendButton: "Send",
    chatErrorInit: "Chat not initialized. Try reloading.",
    chatErrorResponse: "Error getting AI response:",

    // TTS Mode
    ttsModeTitle: "Generate Voice (Text to Speech)",
    ttsModeDesc: "Transform your text into audio. Select the language and voice, and the AI will translate and read the text.",
    textToSpeakLabel: "Text to convert to voice:",
    textToSpeakPlaceholder: "E.g.: 'Hello, I'm AncloraAdapt. How can I help you today?'",
    voiceLanguageLabel: "Voice Language:",
    voiceLabel: "Voice:",
    noVoicesAvailable: "No voices available",
    generateSpeechButton: "Generate Speech",
    generatingSpeech: "Generating Speech...",
    errorEmptyTextToSpeak: "Please write the text you want to convert to voice.",
    errorNoLangOrVoiceSelected: "Please select a language and a voice.",
    errorTranslationFailed: "Translation did not produce any text. Please try again.",
    errorNoAudioReceived: "No audio received from AI. Please try again.",
    errorGeneratingSpeech: "Error generating speech:",

    // Live Chat Mode
    liveChatTitle: "Live Conversation (Beta)",
    liveChatDesc: "Have a real-time conversation with Gemini. Talk to the AI and get instant voice responses.",
    liveChatWarning: "Important: The Live API requires an API key and may incur billing costs. Make sure you have billing enabled in your Google Cloud project.",
    billingInfo: "More about billing",
    selectApiKey: "Select API Key",
    apiKeyErrorChecking: "Error checking API key. Please try again.",
    apiKeyErrorSelection: "Error opening API key selector. Please try again.",
    apiKeyRequiredMessage: "Please select your API key to use live conversation. You may need to enable billing for the Gemini Live API.",
    apiKeyBillingError: "API key or billing error. Please check your API key and billing settings.",
    startConversation: "Start Conversation",
    stopConversation: "Stop Conversation",
    errorLiveSession: "Live session error: %s. Please try to restart.",
    errorStartRecording: "Could not start recording: %s. Make sure microphone is allowed.",
    liveTranscriptEmpty: "Start a conversation to see real-time transcription.",
    liveUserPrefix: "User: ",
    liveAIPrefix: "AI: ",

    // Image Edit Mode
    imageEditModeTitle: "Edición y Generación de Imagen con IA",
    imageEditModeDesc: "Sube una imagen y usa prompts de texto para editarla con Gemini 2.5 Flash Image o, directamente, explica a la IA qué imagen quieres generar.",
    uploadImageOrGenerate: "Sube tu imagen (opcional para generación, necesario para edición):",
    imagePromptEditGenerateLabel: "Prompt de Imagen (Generación o Edición):",
    imagePromptEditGeneratePlaceholder: "Ej: 'Un robot con una patineta roja en un estilo futurista' (para generar) o 'Añade un filtro retro' (para editar)",
    editGenerateImageButton: "Editar/Generar Imagen",
    processingImage: "Procesando Imagen...",
    errorGeneratingOrEditingImage: "Error al editar/generar imagen: %s. Asegúrate de que el prompt sea claro.",

    // Tutorial
    tutorialNext: "Siguiente",
    tutorialPrev: "Anterior",
    tutorialClose: "Cerrar tutorial",
    tutorialStepCount: "Paso %d de %d",
    tutorialTitleWelcome: "Bienvenido a AncloraAdapt",
    tutorialDescWelcome: "Esta guía te ayudará a descubrir cómo transformar y potenciar tu contenido con IA. ¡Vamos a explorar sus modos principales!",
    tutorialTitleBasic: "Modo Básico: Generador Multiformato",
    tutorialDescBasic: "Ideal para generar contenido adaptado a plataformas específicas, tonos e idiomas. Define tu idea, selecciona las opciones y obtén publicaciones listas para usar.",
    tutorialTitleIntelligent: "Modo Inteligente: 'Dime lo que quieres y yo lo adapto'",
    tutorialDescIntelligent: "Describe tu necesidad en lenguaje natural y deja que la IA infiera el mejor contenido, tono y plataformas. Incluso puedes optar por generar o editar imágenes para complementar tu mensaje.",
    tutorialTitleCampaign: "Modo Campaña: 'Multiplica tu mensaje'",
    tutorialDescCampaign: "Crea campañas de marketing coordinadas para múltiples plataformas desde una única idea. La IA adaptará cada mensaje y Call To Action (CTA), y podrás añadir imágenes si lo deseas.",
    tutorialTitleRecycle: "Modo Reciclar de Contenidos",
    tutorialDescRecycle: "Reutiliza contenido existente transformándolo en nuevos formatos como resúmenes, hilos para X, captions de Instagram o títulos persuasivos. ¡Maximiza la vida útil de tu contenido!",
    tutorialTitleChat: "Modo Chat con AncloraAI",
    tutorialDescChat: "Conversa con AncloraAI para obtener ayuda contextual y sugerencias sobre creación y adaptación de contenido. Un asistente siempre a tu disposición para resolver tus dudas.",
    tutorialTitleTTS: "Modo Voz: Texto a Voz",
    tutorialDescTTS: "Convierte texto en audio con voces de IA. Selecciona el idioma de la voz y la IA traducirá automáticamente el texto original a ese idioma antes de generarlo en audio.",
    tutorialTitleLiveChat: "Modo Live Chat: Conversación en Tiempo Real",
    tutorialDescLiveChat: "Experimenta una conversación bidireccional en tiempo real con Gemini. Habla con la IA y recibe respuestas de voz al instante. Requiere una clave API configurada y puede incurrir en costos de facturación.",
    tutorialTitleImage: "Modo Imagen: Edición y Generación Visual",
    tutorialDescImage: "Sube una imagen y usa prompts de texto para editarla con Gemini 2.5 Flash Image o, directamente, explica a la IA qué imagen quieres generar.",
    tutorialTitleReady: "¡Estás listo para empezar!",
    tutorialDescReady: "Hemos cubierto las funcionalidades principales de AncloraAdapt. ¡Ahora explora cada modo y potencia tu comunicación como nunca!",

    // Language/Tones/Platforms (labels)
    lang_detect: 'Detectar automáticamente',
    lang_es: 'Español',
    lang_en: 'English',
    lang_fr: 'Français',
    lang_de: 'Deutsch',
    lang_pt: 'Português',
    lang_it: 'Italiano',
    lang_zh: 'Chino',
    lang_ja: 'Japonés',
    lang_ru: 'Ruso',
    lang_ar: 'Árabe',

    tone_detect: 'Detectar automáticamente',
    tone_Profesional: 'Profesional',
    tone_Amistoso: 'Amistoso',
    tone_Formal: 'Formal',
    tone_Casual: 'Casual',
    tone_Motivador: 'Motivador',
    tone_Emocional: 'Emocional',
    tone_Directo: 'Directo',
    tone_Creativo: 'Creativo',

    platform_LinkedIn: 'LinkedIn',
    platform_X: 'X (Twitter)',
    platform_Instagram: 'Instagram',
    platform_WhatsApp: 'WhatsApp',
    platform_Email: 'Email',
    platform_Web: 'Web (Blog/Artículo)',

    // TTS Voices (labels)
    voice_Kore_es: 'Kore (Femenina) - español neutral',
    voice_Charon_es: 'Charon (Masculina) - español neutral',
    voice_Zephyr_en: 'Zephyr (Female) - English (US)',
    voice_Puck_en: 'Puck (Male) - English (US)',
    voice_Kore_fr: 'Kore (Féminine) - Français',
    voice_Charon_fr: 'Charon (Masculin) - Français',
    voice_Zephyr_de: 'Zephyr (Weiblich) - Deutsch',
    voice_Puck_de: 'Puck (Männlich) - Deutsch',
    voice_Kore_pt: 'Kore (Feminina) - Português',
    voice_Charon_pt: 'Charon (Masculino) - Português',
    voice_Zephyr_it: 'Zephyr (Femminile) - Italiano',
    voice_Puck_it: 'Puck (Maschile) - Italiano',
    voice_Kore_zh: 'Kore (女性) - 中文',
    voice_Charon_zh: 'Charon (男性) - 中文',
    voice_Zephyr_ja: 'Zephyr (女性) - 日本語',
    voice_Puck_ja: 'Puck (男性) - 日本語',
    voice_Kore_ru: 'Kore (Женский) - Русский',
    voice_Charon_ru: 'Charon (Мужской) - Русский',
    voice_Zephyr_ar: 'Zephyr (أنثى) - العربية',
    voice_Puck_ar: 'Puck (ذكر) - العربية',
  }
};

type I18nKey = keyof typeof i18n.es;
const translate = (key: I18nKey, ...args: any[]) => {
  let text = i18n[currentLanguage][key] || key;
  args.forEach((arg, i) => {
    text = text.replace(`%s`, arg);
  });
  return text;
};

let currentLanguage: 'es' | 'en' = 'es'; // Global variable for i18n helper

const languages = [
  { value: 'detect', label: i18n.es.lang_detect, enLabel: i18n.en.lang_detect },
  { value: 'es', label: i18n.es.lang_es, enLabel: i18n.en.lang_es },
  { value: 'en', label: i18n.es.lang_en, enLabel: i18n.en.lang_en },
  { value: 'fr', label: i18n.es.lang_fr, enLabel: i18n.en.lang_fr },
  { value: 'de', label: i18n.es.lang_de, enLabel: i18n.en.lang_de },
  { value: 'pt', label: i18n.es.lang_pt, enLabel: i18n.en.lang_pt },
  { value: 'it', label: i18n.es.lang_it, enLabel: i18n.en.lang_it },
  { value: 'zh', label: i18n.es.lang_zh, enLabel: i18n.en.lang_zh },
  { value: 'ja', label: i18n.es.lang_ja, enLabel: i18n.en.lang_ja },
  { value: 'ru', label: i18n.es.lang_ru, enLabel: i18n.en.lang_ru },
  { value: 'ar', label: i18n.es.lang_ar, enLabel: i18n.en.lang_ar },
];

const tones = [
  { value: 'detect', label: i18n.es.tone_detect, enLabel: i18n.en.tone_detect },
  { value: 'Profesional', label: i18n.es.tone_Profesional, enLabel: i18n.en.tone_Profesional },
  { value: 'Amistoso', label: i18n.es.tone_Amistoso, enLabel: i18n.en.tone_Amistoso },
  { value: 'Formal', label: i18n.es.tone_Formal, enLabel: i18n.en.tone_Formal },
  { value: 'Casual', label: i18n.es.tone_Casual, enLabel: i18n.en.tone_Casual },
  { value: 'Motivador', label: i18n.es.tone_Motivador, enLabel: i18n.en.tone_Motivador },
  { value: 'Emocional', label: i18n.es.tone_Emocional, enLabel: i18n.en.tone_Emocional },
  { value: 'Directo', label: i18n.es.tone_Directo, enLabel: i18n.en.tone_Directo },
  { value: 'Creativo', label: i18n.es.tone_Creativo, enLabel: i18n.en.tone_Creativo },
];

const platforms = [
  { value: 'LinkedIn', label: i18n.es.platform_LinkedIn, enLabel: i18n.en.platform_LinkedIn },
  { value: 'X', label: i18n.es.platform_X, enLabel: i18n.en.platform_X },
  { value: 'Instagram', label: i18n.es.platform_Instagram, enLabel: i18n.en.platform_Instagram },
  { value: 'WhatsApp', label: i18n.es.platform_WhatsApp, enLabel: i18n.en.platform_WhatsApp },
  { value: 'Email', label: i18n.es.platform_Email, enLabel: i18n.en.platform_Email },
  { value: 'Web', label: i18n.es.platform_Web, enLabel: i18n.en.platform_Web },
];

const recycleOptions = [
  { value: 'summary', label: i18n.es.summaryRecycle, enLabel: i18n.en.summaryRecycle },
  { value: 'x_thread', label: i18n.es.xThreadRecycle, enLabel: i18n.en.xThreadRecycle },
  { value: 'instagram_caption', label: i18n.es.instagramCaptionRecycle, enLabel: i18n.en.instagramCaptionRecycle },
  { value: 'title_hook', label: i18n.es.titleHookRecycle, enLabel: i18n.en.titleHookRecycle },
  { value: 'key_points', label: i18n.es.keyPointsRecycle, enLabel: i18n.en.keyPointsRecycle },
  { value: 'email_launch', label: i18n.es.emailLaunchRecycle, enLabel: i18n.en.emailLaunchRecycle },
  { value: 'press_release', label: i18n.es.pressReleaseRecycle, enLabel: i18n.en.pressReleaseRecycle },
];

const ttsLanguageVoiceMap = {
  es: [
    { value: 'Kore', label: i18n.es.voice_Kore_es, enLabel: i18n.en.voice_Kore_es },
    { value: 'Charon', label: i18n.es.voice_Charon_es, enLabel: i18n.en.voice_Charon_es },
  ],
  en: [
    { value: 'Zephyr', label: i18n.es.voice_Zephyr_en, enLabel: i18n.en.voice_Zephyr_en },
    { value: 'Puck', label: i18n.es.voice_Puck_en, enLabel: i18n.en.voice_Puck_en },
  ],
  fr: [
    { value: 'Kore', label: i18n.es.voice_Kore_fr, enLabel: i18n.en.voice_Kore_fr },
    { value: 'Charon', label: i18n.es.voice_Charon_fr, enLabel: i18n.en.voice_Charon_fr },
  ],
  de: [
    { value: 'Zephyr', label: i18n.es.voice_Zephyr_de, enLabel: i18n.en.voice_Zephyr_de },
    { value: 'Puck', label: i18n.es.voice_Puck_de, enLabel: i18n.en.voice_Puck_de },
  ],
  pt: [
    { value: 'Kore', label: i18n.es.voice_Kore_pt, enLabel: i18n.en.voice_Kore_pt },
    { value: 'Charon', label: i18n.es.voice_Charon_pt, enLabel: i18n.en.voice_Charon_pt },
  ],
  it: [
    { value: 'Zephyr', label: i18n.es.voice_Zephyr_it, enLabel: i18n.en.voice_Zephyr_it },
    { value: 'Puck', label: i18n.es.voice_Puck_it, enLabel: i18n.en.voice_Puck_it },
  ],
  zh: [
    { value: 'Kore', label: i18n.es.voice_Kore_zh, enLabel: i18n.en.voice_Kore_zh },
    { value: 'Charon', label: i18n.es.voice_Charon_zh, enLabel: i18n.en.voice_Charon_zh },
  ],
  ja: [
    { value: 'Zephyr', label: i18n.es.voice_Zephyr_ja, enLabel: i18n.en.voice_Zephyr_ja },
    { value: 'Puck', label: i18n.es.voice_Puck_ja, enLabel: i18n.en.voice_Puck_ja },
  ],
  ru: [
    { value: 'Kore', label: i18n.es.voice_Kore_ru, enLabel: i18n.en.voice_Kore_ru },
    { value: 'Charon', label: i18n.es.voice_Charon_ru, enLabel: i18n.en.voice_Charon_ru },
  ],
  ar: [
    { value: 'Zephyr', label: i18n.es.voice_Zephyr_ar, enLabel: i18n.en.voice_Zephyr_ar },
    { value: 'Puck', label: i18n.es.voice_Puck_ar, enLabel: i18n.en.voice_Puck_ar },
  ],
};

const ttsLanguageOptions = [
  { value: 'es', label: i18n.es.lang_es, enLabel: i18n.en.lang_es },
  { value: 'en', label: i18n.es.lang_en, enLabel: i18n.en.lang_en },
  { value: 'fr', label: i18n.es.lang_fr, enLabel: i18n.en.lang_fr },
  { value: 'de', label: i18n.es.lang_de, enLabel: i18n.en.lang_de },
  { value: 'pt', label: i18n.es.lang_pt, enLabel: i18n.en.lang_pt },
  { value: 'it', label: i18n.es.lang_it, enLabel: i18n.en.lang_it },
  { value: 'zh', label: i18n.es.lang_zh, enLabel: i18n.en.lang_zh },
  { value: 'ja', label: i18n.es.lang_ja, enLabel: i18n.en.lang_ja },
  { value: 'ru', label: i18n.es.lang_ru, enLabel: i18n.en.lang_ru },
  { value: 'ar', label: i18n.es.lang_ar, enLabel: i18n.en.lang_ar },
];


const outputSchema = {
  type: Type.OBJECT,
  properties: {
    outputs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          platform: {
            type: Type.STRING,
            description: "The platform for which the content is generated (e.g., LinkedIn, X, Instagram, WhatsApp, Email, Web).",
          },
          content: {
            type: Type.STRING,
            description: "The generated content adapted for the specific platform, tone, and language.",
          },
        },
        required: ["platform", "content"],
        propertyOrdering: ["platform", "content"],
      },
    },
  },
  required: ["outputs"],
  propertyOrdering: ["outputs"],
};

const commonStyles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '30px 20px',
    maxWidth: '1280px',
    margin: '0 auto',
    minHeight: '100vh',
    boxSizing: 'border-box',
    gap: '30px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative', // Para posicionar el botón de ayuda
  },
  title: {
    fontFamily: '"Libre Baskerville", serif',
    color: 'var(--azul-profundo)',
    fontSize: '3.2em',
    margin: '0 0 10px 0',
  },
  subtitle: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '1.2em',
    color: 'var(--texto)',
    opacity: 0.85,
    margin: 0,
  },
  controlsWrapper: {
    position: 'absolute',
    right: '0',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  themeToggleButton: {
    backgroundColor: 'var(--card-bg)', // Use card background
    color: 'var(--texto)',
    border: '1px solid var(--input-border)',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    fontSize: '1.1em',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease, color 0.2s ease',
  },
  languageToggleButton: {
    backgroundColor: 'var(--card-bg)', // Use card background
    color: 'var(--texto)',
    border: '1px solid var(--input-border)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '0.9em',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease',
  },
  helpButton: {
    backgroundColor: 'var(--azul-claro)',
    color: 'var(--blanco)',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    fontSize: '1.2em',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(46, 175, 196, 0.4)',
    transition: 'background-color 0.2s ease',
  },
  mainContent: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
    backgroundColor: 'var(--blanco)',
    padding: '30px',
    borderRadius: '18px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.06)',
  },
  tabNavigation: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap', // Allow tabs to wrap on smaller screens
    marginBottom: '30px',
    borderBottom: '2px solid var(--tab-border-bottom)',
    width: '100%',
  },
  tabButton: {
    backgroundColor: 'transparent',
    border: 'none',
    padding: '15px 15px', // Reduced padding for more tabs
    fontSize: '1em', // Reduced font size for more tabs
    fontWeight: 600,
    color: 'var(--texto)',
    cursor: 'pointer',
    position: 'relative',
    transition: 'color 0.3s ease',
    outline: 'none',
    opacity: 0.7,
    flexShrink: 0, // Prevent buttons from shrinking too much
  },
  tabButtonActive: {
    color: 'var(--azul-claro)',
    opacity: 1,
  },
  tabButtonActiveUnderline: {
    content: '""',
    position: 'absolute',
    bottom: '-2px',
    left: '0',
    width: '100%',
    height: '2px',
    backgroundColor: 'var(--azul-claro)',
  },
  section: {
    marginBottom: '25px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '1.1em',
    fontWeight: 600,
    color: 'var(--azul-profundo)',
  },
  textarea: {
    width: '100%',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid var(--input-border)',
    fontSize: '1em',
    color: 'var(--texto)',
    resize: 'vertical',
    boxSizing: 'border-box',
    marginBottom: '15px',
    backgroundColor: 'var(--input-bg)',
  },
  voiceButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--input-border)', // Use a neutral color from current theme
    color: 'var(--texto)',
    fontSize: '1em',
    cursor: 'not-allowed',
    opacity: 0.7,
    fontWeight: 500,
  },
  configSection: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '25px',
    marginBottom: '20px',
  },
  configGroup: {
    flex: '1 1 calc(33% - 25px)',
    minWidth: '200px',
  },
  select: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid var(--input-border)',
    fontSize: '1em',
    color: 'var(--texto)',
    backgroundColor: 'var(--input-bg)',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%237f8c8d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '20px',
  },
  platformCheckboxes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--checkbox-bg)',
    padding: '8px 15px',
    borderRadius: '20px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    color: 'var(--texto)',
  },
  checkboxInput: {
    marginRight: '8px',
    cursor: 'pointer',
  },
  generateButton: {
    width: '100%',
    padding: '15px 25px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(90deg, var(--azul-claro), var(--ambar))',
    color: '#162032', // Fixed dark text color for high contrast on light gradient
    fontSize: '1.2em',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.3s ease',
    boxShadow: '0 4px 10px rgba(46, 175, 196, 0.3)',
  },
  generateButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  errorMessage: {
    color: '#e74c3c',
    backgroundColor: 'var(--blanco)', // Adjusted for theme
    border: '1px solid #e74c3c',
    padding: '15px',
    borderRadius: '8px',
    marginTop: '20px',
    textAlign: 'center',
  },
  loadingMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px',
    marginTop: '20px',
    color: 'var(--texto)',
  },
  spinner: {
    border: '4px solid rgba(0, 0, 0, 0.1)',
    borderTop: '4px solid var(--azul-claro)',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
  },
  outputSection: {
    marginTop: '40px',
    borderTop: '1px solid var(--input-border)', // Use a neutral color
    paddingTop: '30px',
  },
  outputSectionTitle: {
    fontSize: '1.8em',
    color: 'var(--azul-profundo)',
    marginBottom: '25px',
    textAlign: 'center',
  },
  outputGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '25px',
  },
  outputCard: {
    backgroundColor: 'var(--card-bg)', // Use card background
    border: '1px solid var(--card-border)', // Use card border
    borderRadius: '10px',
    padding: '25px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  outputCardTitle: {
    fontSize: '1.4em',
    color: 'var(--azul-claro)',
    marginBottom: '15px',
    borderBottom: '1px solid var(--input-border)', // Use a neutral color
    paddingBottom: '10px',
  },
  outputCardContent: {
    fontSize: '1em',
    color: 'var(--texto)',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    marginBottom: '20px',
    flexGrow: 1,
  },
  copyButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 15px',
    borderRadius: '6px',
    border: '1px solid var(--azul-claro)',
    backgroundColor: 'var(--blanco)',
    color: 'var(--azul-claro)',
    fontSize: '0.9em',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease',
    width: 'fit-content',
    alignSelf: 'flex-end',
  },
  // Chat specific styles
  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    height: '500px',
    border: '1px solid var(--input-border)',
    borderRadius: '10px',
    padding: '15px',
    overflowY: 'auto',
    backgroundColor: 'var(--gris-fondo)',
  },
  chatMessage: {
    padding: '10px 15px',
    borderRadius: '15px',
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'var(--azul-claro)',
    color: 'var(--blanco)',
    borderBottomRightRadius: '2px',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'var(--chat-message-ai-bg)', // Dynamic for theme
    color: 'var(--texto)',
    borderBottomLeftRadius: '2px',
  },
  chatInputContainer: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
  },
  chatInput: {
    flexGrow: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid var(--input-border)',
    fontSize: '1em',
    color: 'var(--texto)',
    backgroundColor: 'var(--input-bg)',
  },
  chatButton: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--azul-claro)',
    color: 'var(--blanco)',
    fontSize: '1em',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  // Live Chat specific styles
  liveChatControl: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    marginBottom: '20px',
  },
  liveChatButton: {
    padding: '12px 25px',
    borderRadius: '10px',
    border: 'none',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    fontSize: '1em',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  startRecording: {
    backgroundColor: 'var(--azul-claro)',
    color: 'var(--blanco)',
  },
  stopRecording: {
    backgroundColor: '#e74c3c',
    color: 'var(--blanco)',
  },
  liveTranscript: {
    backgroundColor: 'var(--gris-fondo)',
    border: '1px solid var(--input-border)',
    borderRadius: '10px',
    padding: '15px',
    minHeight: '150px',
    maxHeight: '300px',
    overflowY: 'auto',
    marginBottom: '20px',
    color: 'var(--texto)',
    lineHeight: '1.6',
  },
  liveTranscriptUser: {
    fontWeight: 600,
    color: 'var(--azul-profundo)',
  },
  liveTranscriptAI: {
    fontStyle: 'italic',
    color: 'var(--texto)',
  },
  warningMessage: {
    backgroundColor: 'var(--warning-bg)', // Dynamic background from theme variables
    color: 'var(--warning-text-color)', // Dynamic text color from theme variables
    padding: '10px',
    borderRadius: '8px',
    textAlign: 'center',
    marginBottom: '15px',
    fontSize: '0.9em',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '300px',
    objectFit: 'contain',
    borderRadius: '8px',
    border: '1px solid var(--input-border)',
    marginTop: '15px',
    marginBottom: '15px',
  },
  audioPlayer: {
    width: '100%',
    marginTop: '15px',
    marginBottom: '15px',
  },
  fileInput: {
    display: 'block',
    width: '100%',
    padding: '10px 0',
    marginBottom: '10px',
    border: '1px solid var(--input-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--texto)',
    cursor: 'pointer',
  },
  // Tutorial Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'var(--blanco)',
    padding: '30px',
    borderRadius: '15px',
    maxWidth: '600px',
    width: '90%',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: '15px',
    right: '15px',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '1.5em',
    color: 'var(--texto)',
    cursor: 'pointer',
    opacity: 0.7,
  },
  modalTitle: {
    fontFamily: '"Libre Baskerville", serif',
    color: 'var(--azul-profundo)',
    fontSize: '2em',
    marginBottom: '10px',
  },
  modalDescription: {
    fontSize: '1em',
    color: 'var(--texto)',
    lineHeight: '1.6',
  },
  modalNavigation: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '20px',
  },
  modalNavButton: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--azul-claro)',
    color: 'var(--blanco)',
    fontSize: '1em',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  modalNavButtonSecondary: {
    backgroundColor: 'var(--input-border)', // Neutral color for secondary
    color: 'var(--texto)',
  },
  modalNavButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

// Keyframe for spinner animation and hover styles
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.checkboxLabel:hover {
  background-color: var(--input-border); /* Adjusted for theme */
}
.generateButton:hover:not(:disabled) {
  opacity: 0.8;
}
.copyButton:hover {
  background-color: var(--azul-claro);
  color: var(--blanco);
}
.tabButton:hover:not(.active) {
  color: var(--azul-claro);
  opacity: 0.9;
}
.chatButton:hover {
  background-color: #2697a8;
}
.liveChatButton.startRecording:hover {
  background-color: #2697a8;
}
.liveChatButton.stopRecording:hover {
  background-color: #c0392b;
}
input[type="file"]::file-selector-button {
  background-color: var(--azul-claro);
  color: var(--blanco);
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-right: 10px;
}
input[type="file"]::file-selector-button:hover {
  background-color: #2697a8;
}
${commonStyles.helpButton}:hover {
  background-color: #2697a8;
}
${commonStyles.modalNavButton}:hover:not(:disabled) {
  background-color: #2697a8;
}
${commonStyles.modalNavButtonSecondary}:hover:not(:disabled) {
  background-color: var(--azul-profundo); /* Darker shade of blue for secondary hover */
  color: var(--blanco);
}
${commonStyles.themeToggleButton}:hover, ${commonStyles.languageToggleButton}:hover {
  background-color: var(--input-border);
  opacity: 0.8;
}

@media (max-width: 768px) {
  ${commonStyles.title} { font-size: 2.5em; }
  ${commonStyles.subtitle} { font-size: 1em; }
  ${commonStyles.header} { flex-direction: column; gap: 15px; }
  ${commonStyles.controlsWrapper} { position: static; transform: none; width: 100%; justify-content: center; }
  ${commonStyles.tabButton} { padding: 10px 10px; font-size: 0.9em; }
  ${commonStyles.configGroup} { flex: 1 1 100%; min-width: unset; }
  ${commonStyles.outputGrid} { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  ${commonStyles.title} { font-size: 2em; }
  ${commonStyles.subtitle} { font-size: 0.9em; }
  ${commonStyles.mainContent} { padding: 20px; }
  ${commonStyles.textarea}, ${commonStyles.select}, ${commonStyles.generateButton} { font-size: 0.9em; padding: 12px; }
  ${commonStyles.voiceButton} { font-size: 0.9em; padding: 8px 15px; }
  ${commonStyles.modalContent} { width: 95%; padding: 20px; }
}
`;
document.head.appendChild(styleSheet);


const OutputDisplay: React.FC<OutputDisplayProps> = ({ generatedOutputs, onCopy, isLoading, error, audioUrl, generatedImageUrl }) => {
  const getImageFileName = (url: string): string => {
    try {
      const mimeMatch = url.match(/^data:(image\/[a-z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const extension = mimeType.split('/')[1] || 'png';
      return `anclora_image.${extension}`;
    } catch (e) {
      console.error("Error parsing image URL for filename:", e);
      return 'anclora_image.png';
    }
  };

  return (
    <>
      {error && (
        <div style={commonStyles.errorMessage} role="alert">
          {error}
        </div>
      )}

      {isLoading && (
        <div style={commonStyles.loadingMessage} role="status" aria-live="polite">
          <div style={commonStyles.spinner}></div>
          <p>{translate('loadingText')}</p>
        </div>
      )}

      {audioUrl && (
        <section style={commonStyles.outputSection} aria-label={translate('generatedAudioTitle')}>
          <h2 style={commonStyles.outputSectionTitle}>{translate('generatedAudioTitle')}</h2>
          <audio controls src={audioUrl} style={commonStyles.audioPlayer} aria-label={translate('generatedAudioTitle')}></audio>
          <a href={audioUrl} download="anclora_speech.wav" style={{...commonStyles.copyButton, marginTop: '10px'}} aria-label={translate('downloadAudio')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-download">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span style={{ marginLeft: '4px' }}>{translate('downloadAudio')}</span>
          </a>
        </section>
      )}

      {generatedImageUrl && (
        <section style={commonStyles.outputSection} aria-label={translate('generatedImageTitle')}>
          <h2 style={commonStyles.outputSectionTitle}>{translate('generatedImageTitle')}</h2>
          <img src={generatedImageUrl} alt="Contenido generado por IA" style={commonStyles.imagePreview} />
          <a href={generatedImageUrl} download={getImageFileName(generatedImageUrl)} style={{...commonStyles.copyButton, marginTop: '10px'}} aria-label={translate('downloadImage')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-download">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span style={{ marginLeft: '4px' }}>{translate('downloadImage')}</span>
          </a>
        </section>
      )}

      {generatedOutputs && generatedOutputs.length > 0 && (
        <section style={commonStyles.outputSection} aria-label={translate('resultsAdaptedTitle')}>
          <h2 style={commonStyles.outputSectionTitle}>{translate('resultsAdaptedTitle')}</h2>
          <div style={commonStyles.outputGrid}>
            {generatedOutputs.map((output, index) => (
              <div key={index} style={commonStyles.outputCard}>
                <h3 style={commonStyles.outputCardTitle}>{translate(`platform_${output.platform}` as I18nKey) || output.platform}</h3>
                <p style={commonStyles.outputCardContent}>{output.content}</p>
                <button
                  onClick={() => onCopy(output.content)}
                  style={commonStyles.copyButton}
                  aria-label={`${translate('copyButton')} ${translate(`platform_${output.platform}` as I18nKey) || output.platform}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-copy">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span style={{ marginLeft: '4px' }}>{translate('copyButton')}</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
};


const BasicMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, setGeneratedImageUrl }) => {
  const [userInput, setUserInput] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('es');
  const [selectedTone, setSelectedTone] = useState<string>('detect');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['LinkedIn', 'X', 'Instagram']);
  const [responseSpeed, setResponseSpeed] = useState<string>('flash'); // 'flash' or 'flash-lite'

  useEffect(() => {
    setGeneratedImageUrl(null); // Clear image when switching tabs/modes
  }, [setGeneratedImageUrl]);

  const handlePlatformChange = (platformValue: string) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platformValue)) {
        return prev.filter(p => p !== platformValue);
      } else {
        return [...prev, platformValue];
      }
    });
  };

  const generateBasicContent = useCallback(async () => {
    if (!userInput.trim()) {
      setError(translate('errorEmptyInput'));
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError(translate('errorNoPlatformSelected'));
      return;
    }

    const platformList = selectedPlatforms.map(p => (currentLanguage === 'es' ? platforms.find(pl => pl.value === p)?.label : platforms.find(pl => pl.value === p)?.enLabel) || p).join(', ');
    const languageDisplay = (currentLanguage === 'es' ? languages.find(lang => lang.value === selectedLanguage)?.label : languages.find(lang => lang.value === selectedLanguage)?.enLabel) || selectedLanguage;
    const toneDisplay = (currentLanguage === 'es' ? tones.find(t => t.value === selectedTone)?.label : tones.find(t => t.value === selectedTone)?.enLabel) || selectedTone;

    const prompt = `You are an expert in digital communication. I will give you a main idea and the desired platforms, tones, and languages. Generate unique content for each platform, adapted to the specified tone and language. The output must be a JSON object with an 'outputs' property containing an array of objects. Each object in the array must have 'platform' and 'content' properties.

Main idea: '${userInput}'
Output Language: ${languageDisplay}
General Tone: ${toneDisplay}
Required Platforms: ${platformList}

Example output format:
\`\`\`json
{
  "outputs": [
    { "platform": "LinkedIn", "content": "Professional content for LinkedIn here..." },
    { "platform": "X", "content": "Concise tweet for X here..." }
  ]
}
\`\`\`
Now, generate the content based on the provided idea and configurations.`;

    const modelToUse = responseSpeed === 'flash-lite' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';
    await onGenerate(prompt, outputSchema, modelToUse);
  }, [userInput, selectedLanguage, selectedTone, selectedPlatforms, responseSpeed, onGenerate, setError]);

  return (
    <>
      <section style={commonStyles.section}>
        <label htmlFor="userInputBasic" style={commonStyles.label}>{translate('mainIdeaLabel')}</label>
        <textarea
          id="userInputBasic"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={translate('mainIdeaPlaceholder')}
          rows={6}
          style={commonStyles.textarea}
          aria-label={translate('mainIdeaLabel')}
        />
        <button style={commonStyles.voiceButton} disabled aria-label={translate('voiceInputSoon')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
          <span style={{ marginLeft: '8px' }}>{translate('voiceInputSoon')}</span>
        </button>
      </section>

      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label htmlFor="languageSelectBasic" style={commonStyles.label}>{translate('outputLanguageLabel')}</label>
          <select
            id="languageSelectBasic"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            style={commonStyles.select}
            aria-label={translate('outputLanguageLabel')}
          >
            {languages.map(lang => (
              <option key={lang.value} value={lang.value}>{currentLanguage === 'es' ? lang.label : lang.enLabel}</option>
            ))}
          </select>
        </div>

        <div style={commonStyles.configGroup}>
          <label htmlFor="toneSelectBasic" style={commonStyles.label}>{translate('toneLabel')}</label>
          <select
            id="toneSelectBasic"
            value={selectedTone}
            onChange={(e) => setSelectedTone(e.target.value)}
            style={commonStyles.select}
            aria-label={translate('toneLabel')}
          >
            {tones.map(tone => (
              <option key={tone.value} value={tone.value}>{currentLanguage === 'es' ? tone.label : tone.enLabel}</option>
            ))}
          </select>
        </div>

        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{translate('platformsLabel')}</label>
          <div style={commonStyles.platformCheckboxes} role="group" aria-labelledby="platformSelectLabel">
            {platforms.map(platform => (
              <label key={platform.value} className="checkboxLabel">
                <input
                  type="checkbox"
                  value={platform.value}
                  checked={selectedPlatforms.includes(platform.value)}
                  onChange={() => handlePlatformChange(platform.value)}
                  style={commonStyles.checkboxInput}
                  aria-checked={selectedPlatforms.includes(platform.value)}
                />
                {currentLanguage === 'es' ? platform.label : platform.enLabel}
              </label>
            ))}
          </div>
        </div>
        <div style={commonStyles.configGroup}>
          <label htmlFor="responseSpeedSelect" style={commonStyles.label}>{translate('responseSpeedLabel')}</label>
          <select
            id="responseSpeedSelect"
            value={responseSpeed}
            onChange={(e) => setResponseSpeed(e.target.value)}
            style={commonStyles.select}
            aria-label={translate('responseSpeedLabel')}
          >
            <option value="flash">{translate('normalSpeed')}</option>
            <option value="flash-lite">{translate('fastSpeed')}</option>
          </select>
        </div>
      </section>

      <button
        onClick={generateBasicContent}
        disabled={isLoading}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? translate('generating') : translate('generateContentButton')}
      </button>

      <OutputDisplay isLoading={isLoading} error={error} generatedOutputs={generatedOutputs} onCopy={onCopy} />
    </>
  );
};

const IntelligentMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, setGeneratedImageUrl }) => {
  const [userInput, setUserInput] = useState<string>('');
  const [deepThinking, setDeepThinking] = useState<boolean>(false);
  const [includeImage, setIncludeImage] = useState<boolean>(false);
  const [imageMode, setImageMode] = useState<'generate' | 'edit'>('generate');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setGeneratedImageUrl(null); // Clear image when switching tabs/modes
    setImageFile(null);
    setImagePreviewUrl(null);
  }, [setGeneratedImageUrl]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const generateIntelligentContent = useCallback(async () => {
    if (!userInput.trim()) {
      setError(translate('errorEmptyInput'));
      return;
    }
    if (includeImage && imageMode === 'edit' && !imageFile) {
        setError(translate('errorImageEditNoFile'));
        return;
    }
    if (includeImage && !imagePrompt.trim()) {
        setError(translate('errorImagePromptEmpty'));
        return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImageUrl(null); // Clear previous image output

    try {
      if (!API_KEY) {
        throw new Error(translate('apiKeyNotFound'));
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      const textGenerationPrompt = `You are a highly intelligent and creative digital communication assistant. Your task is to take an idea or need expressed by the user in natural language and transform it into adapted content for various platforms. You must infer the language, tone, most suitable platforms, and optimal format (post, message, email, etc.) from the user's input.

The output must be a JSON object with an 'outputs' property containing an array of objects. Each object in the array must have 'platform' and 'content' properties. If no platforms are specified, choose the 3-5 most relevant ones.

User input: '${userInput}'

Example output format:
\`\`\`json
{
  "outputs": [
    { "platform": "LinkedIn", "content": "Inferred professional content for LinkedIn here..." },
    { "platform": "X", "content": "Inferred concise tweet for X here..." }
  ]
}
\`\`\`
Now, interpret the user's input and generate the adapted content.`;

      const modelToUse = deepThinking ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
      const config = deepThinking ? { thinkingConfig: { thinkingBudget: 32768 } } : undefined;

      // First, generate text content
      await onGenerate(textGenerationPrompt, outputSchema, modelToUse, config);

      // Then, if image is included, generate/edit image
      if (includeImage) {
        let imageContents: any[] = [];
        if (imageMode === 'edit' && imageFile) {
          const base64ImageData = await fileToBase64(imageFile);
          imageContents.push({ inlineData: { data: base64ImageData, mimeType: imageFile.type } });
        }
        imageContents.push({ text: imagePrompt });

        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: imageContents },
          config: { responseModalities: [Modality.IMAGE] },
        });

        const generatedImagePart = imageResponse.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (generatedImagePart?.inlineData) {
          const base64ImageBytes: string = generatedImagePart.inlineData.data;
          const imageUrl = `data:${generatedImagePart.inlineData.mimeType};base64,${base64ImageBytes}`;
          setGeneratedImageUrl(imageUrl);
        } else {
          setError(translate('errorNoImageReceived'));
        }
      }

    } catch (err: any) {
      console.error(translate('errorGeneratingSmartContentOrImage'), err);
      setError(translate('generalError', err.message || translate('generalError')));
    } finally {
      setIsLoading(false); // Intelligent mode always sets isLoading to false here
    }
  }, [userInput, deepThinking, includeImage, imageMode, imageFile, imagePrompt, onGenerate, setError, setGeneratedImageUrl, setIsLoading]);


  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">{translate('intelligentModeTitle')}</h3>
        <p>{translate('intelligentModeDesc')}</p>
        <label htmlFor="userInputIntelligent" style={commonStyles.label}>{translate('conversationalMessageLabel')}</label>
        <textarea
          id="userInputIntelligent"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={translate('conversationalMessagePlaceholder')}
          rows={8}
          style={commonStyles.textarea}
          aria-label={translate('conversationalMessageLabel')}
        />
      </section>
      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
            <label className="checkboxLabel" style={{backgroundColor: 'transparent'}}>
                <input
                    type="checkbox"
                    checked={deepThinking}
                    onChange={() => setDeepThinking(prev => !prev)}
                    style={commonStyles.checkboxInput}
                />
                <span style={{fontWeight: 600, color: 'var(--azul-profundo)'}}>{translate('deepThinkingCheckbox')}</span>
                <span style={{marginLeft: '8px', fontSize: '0.9em', opacity: 0.8}}>{translate('deepThinkingHint')}</span>
            </label>
        </div>
        <div style={commonStyles.configGroup}>
            <label className="checkboxLabel" style={{backgroundColor: 'transparent'}}>
                <input
                    type="checkbox"
                    checked={includeImage}
                    onChange={() => setIncludeImage(prev => !prev)}
                    style={commonStyles.checkboxInput}
                />
                <span style={{fontWeight: 600, color: 'var(--azul-profundo)'}}>{translate('includeImageCheckbox')}</span>
                <span style={{marginLeft: '8px', fontSize: '0.9em', opacity: 0.8}}>{translate('includeImageHint')}</span>
            </label>
        </div>
      </section>

      {includeImage && (
        <section style={commonStyles.section}>
            <h4 className="h3" style={{fontSize: '1.2em', marginTop: '0'}}>{translate('imageConfigTitle')}</h4>
            <div style={{display: 'flex', gap: '20px', marginBottom: '15px'}}>
                <label className="checkboxLabel">
                    <input
                        type="radio"
                        name="imageModeIntelligent"
                        value="generate"
                        checked={imageMode === 'generate'}
                        onChange={() => {setImageMode('generate'); setImageFile(null); setImagePreviewUrl(null);}}
                        style={commonStyles.checkboxInput}
                    />
                    {translate('generateNewImageRadio')}
                </label>
                <label className="checkboxLabel">
                    <input
                        type="radio"
                        name="imageModeIntelligent"
                        value="edit"
                        checked={imageMode === 'edit'}
                        onChange={() => setImageMode('edit')}
                        style={commonStyles.checkboxInput}
                    />
                    {translate('editExistingImageRadio')}
                </label>
            </div>

            {imageMode === 'edit' && (
                <div style={{marginBottom: '15px'}}>
                    <label htmlFor="imageUploadIntelligent" style={commonStyles.label}>{translate('uploadImageLabel')}</label>
                    <input
                        id="imageUploadIntelligent"
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        style={commonStyles.fileInput}
                        aria-label={translate('uploadImageLabel')}
                    />
                    {imagePreviewUrl && (
                        <div style={{marginTop: '15px'}}>
                            <h4 style={{fontSize: '1em', color: 'var(--texto)', opacity: 0.8}}>{translate('imagePreview')}</h4>
                            <img src={imagePreviewUrl} alt={translate('imagePreview')} style={commonStyles.imagePreview} />
                        </div>
                    )}
                </div>
            )}

            <label htmlFor="imagePromptIntelligent" style={commonStyles.label}>{translate('imagePromptLabel')}</label>
            <textarea
                id="imagePromptIntelligent"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder={imageMode === 'generate' ? translate('imagePromptGeneratePlaceholder') : translate('imagePromptEditPlaceholder')}
                rows={4}
                style={commonStyles.textarea}
                aria-label={translate('imagePromptLabel')}
            />
        </section>
      )}

      <button
        onClick={generateIntelligentContent}
        disabled={isLoading || (includeImage && imageMode === 'edit' && !imageFile) || (includeImage && !imagePrompt.trim())}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? translate('interpretingAndGenerating') : translate('interpretAndGenerateButton')}
      </button>

      <OutputDisplay isLoading={isLoading} error={error} generatedOutputs={generatedOutputs} onCopy={onCopy} generatedImageUrl={generatedOutputs ? undefined : undefined} />
    </>
  );
};

const CampaignMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, setGeneratedImageUrl }) => {
  const [userInput, setUserInput] = useState<string>('');
  const campaignPlatforms = ['LinkedIn', 'X', 'Instagram', 'Email', 'WhatsApp']; // Fixed for campaign mode
  const [selectedLanguage, setSelectedLanguage] = useState<string>('es');
  const [deepThinking, setDeepThinking] = useState<boolean>(false);
  const [includeImage, setIncludeImage] = useState<boolean>(false);
  const [imageMode, setImageMode] = useState<'generate' | 'edit'>('generate');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setGeneratedImageUrl(null); // Clear image when switching tabs/modes
    setImageFile(null);
    setImagePreviewUrl(null);
  }, [setGeneratedImageUrl]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };


  const generateCampaignContent = useCallback(async () => {
    if (!userInput.trim()) {
      setError(translate('errorEmptyCampaignIdea'));
      return;
    }
    if (includeImage && imageMode === 'edit' && !imageFile) {
        setError(translate('errorImageEditNoFile'));
        return;
    }
    if (includeImage && !imagePrompt.trim()) {
        setError(translate('errorImagePromptEmpty'));
        return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImageUrl(null); // Clear previous image output

    try {
      if (!API_KEY) {
        throw new Error(translate('apiKeyNotFound'));
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      const platformList = campaignPlatforms.map(p => (currentLanguage === 'es' ? platforms.find(pl => pl.value === p)?.label : platforms.find(pl => pl.value === p)?.enLabel) || p).join(', ');
      const languageDisplay = (currentLanguage === 'es' ? languages.find(lang => lang.value === selectedLanguage)?.label : languages.find(lang => lang.value === selectedLanguage)?.enLabel) || selectedLanguage;

      const textGenerationPrompt = `You are an expert digital marketing strategist. Generate a set of coordinated messages for an express marketing campaign, based on the user's main idea. Each message must be adapted to the specific characteristics of the platform, maintain a consistent and persuasive tone, and include a relevant Call To Action (CTA) for each channel. The language for all outputs must be '${languageDisplay}'.

The output must be a JSON object with an 'outputs' property containing an array of objects. Each object in the array must have 'platform' and 'content' properties.

Main campaign idea: '${userInput}'
Target platforms: ${platformList}

Example output format:
\`\`\`json
{
  "outputs": [
    { "platform": "LinkedIn", "content": "Professional motivating post with CTA for LinkedIn..." },
    { "platform": "Instagram", "content": "Emotional and direct caption with emojis and CTA for Instagram..." }
  ]
}
\`\`\`
Now, generate the coordinated contents for the campaign.`;

      const modelToUse = deepThinking ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
      const config = deepThinking ? { thinkingConfig: { thinkingBudget: 32768 } } : undefined;

      // First, generate text content
      await onGenerate(textGenerationPrompt, outputSchema, modelToUse, config);

      // Then, if image is included, generate/edit image
      if (includeImage) {
        let imageContents: any[] = [];
        if (imageMode === 'edit' && imageFile) {
          const base64ImageData = await fileToBase64(imageFile);
          imageContents.push({ inlineData: { data: base64ImageData, mimeType: imageFile.type } });
        }
        imageContents.push({ text: imagePrompt });

        const imageResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: imageContents },
          config: { responseModalities: [Modality.IMAGE] },
        });

        const generatedImagePart = imageResponse.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (generatedImagePart?.inlineData) {
          const base64ImageBytes: string = generatedImagePart.inlineData.data;
          const imageUrl = `data:${generatedImagePart.inlineData.mimeType};base64,${base64ImageBytes}`;
          setGeneratedImageUrl(imageUrl);
        } else {
          setError(translate('errorNoImageReceived'));
        }
      }

    } catch (err: any) {
      console.error(translate('errorGeneratingCampaignOrImage'), err);
      setError(translate('generalError', err.message || translate('generalError')));
    } finally {
      setIsLoading(false);
    }
  }, [userInput, selectedLanguage, deepThinking, includeImage, imageMode, imageFile, imagePrompt, onGenerate, setError, setGeneratedImageUrl, setIsLoading]);

  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">{translate('campaignModeTitle')}</h3>
        <p>{translate('campaignModeDesc')}</p>
        <label htmlFor="userInputCampaign" style={commonStyles.label}>{translate('campaignIdeaLabel')}</label>
        <textarea
          id="userInputCampaign"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder={translate('campaignIdeaPlaceholder')}
          rows={6}
          style={commonStyles.textarea}
          aria-label={translate('campaignIdeaLabel')}
        />
      </section>

      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
            <label htmlFor="languageSelectCampaign" style={commonStyles.label}>{translate('outputLanguageLabel')}</label>
            <select
              id="languageSelectCampaign"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={commonStyles.select}
              aria-label={translate('outputLanguageLabel')}
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>{currentLanguage === 'es' ? lang.label : lang.enLabel}</option>
              ))}
            </select>
          </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{translate('campaignPlatformsLabel')}</label>
          <div style={commonStyles.platformCheckboxes}>
            {campaignPlatforms.map(platformValue => (
              <span key={platformValue} className="tag">{currentLanguage === 'es' ? platforms.find(p => p.value === platformValue)?.label : platforms.find(p => p.value === platformValue)?.enLabel || platformValue}</span>
            ))}
          </div>
        </div>
        <div style={commonStyles.configGroup}>
            <label className="checkboxLabel" style={{backgroundColor: 'transparent'}}>
                <input
                    type="checkbox"
                    checked={deepThinking}
                    onChange={() => setDeepThinking(prev => !prev)}
                    style={commonStyles.checkboxInput}
                />
                <span style={{fontWeight: 600, color: 'var(--azul-profundo)'}}>{translate('deepThinkingCheckbox')}</span>
                <span style={{marginLeft: '8px', fontSize: '0.9em', opacity: 0.8}}>{translate('campaignDeepThinkingHint')}</span>
            </label>
        </div>
        <div style={commonStyles.configGroup}>
            <label className="checkboxLabel" style={{backgroundColor: 'transparent'}}>
                <input
                    type="checkbox"
                    checked={includeImage}
                    onChange={() => setIncludeImage(prev => !prev)}
                    style={commonStyles.checkboxInput}
                />
                <span style={{fontWeight: 600, color: 'var(--azul-profundo)'}}>{translate('includeImageCheckbox')}</span>
                <span style={{marginLeft: '8px', fontSize: '0.9em', opacity: 0.8}}>{translate('campaignIncludeImageHint')}</span>
            </label>
        </div>
      </section>

      {includeImage && (
        <section style={commonStyles.section}>
            <h4 className="h3" style={{fontSize: '1.2em', marginTop: '0'}}>{translate('imageConfigTitle')}</h4>
            <div style={{display: 'flex', gap: '20px', marginBottom: '15px'}}>
                <label className="checkboxLabel">
                    <input
                        type="radio"
                        name="imageModeCampaign"
                        value="generate"
                        checked={imageMode === 'generate'}
                        onChange={() => {setImageMode('generate'); setImageFile(null); setImagePreviewUrl(null);}}
                        style={commonStyles.checkboxInput}
                    />
                    {translate('generateNewImageRadio')}
                </label>
                <label className="checkboxLabel">
                    <input
                        type="radio"
                        name="imageModeCampaign"
                        value="edit"
                        checked={imageMode === 'edit'}
                        onChange={() => setImageMode('edit')}
                        style={commonStyles.checkboxInput}
                    />
                    {translate('editExistingImageRadio')}
                </label>
            </div>

            {imageMode === 'edit' && (
                <div style={{marginBottom: '15px'}}>
                    <label htmlFor="imageUploadCampaign" style={commonStyles.label}>{translate('uploadImageLabel')}</label>
                    <input
                        id="imageUploadCampaign"
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        style={commonStyles.fileInput}
                        aria-label={translate('uploadImageLabel')}
                    />
                    {imagePreviewUrl && (
                        <div style={{marginTop: '15px'}}>
                            <h4 style={{fontSize: '1em', color: 'var(--texto)', opacity: 0.8}}>{translate('imagePreview')}</h4>
                            <img src={imagePreviewUrl} alt={translate('imagePreview')} style={commonStyles.imagePreview} />
                        </div>
                    )}
                </div>
            )}

            <label htmlFor="imagePromptCampaign" style={commonStyles.label}>{translate('imagePromptLabel')}</label>
            <textarea
                id="imagePromptCampaign"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder={imageMode === 'generate' ? translate('campaignImagePromptGeneratePlaceholder') : translate('campaignImagePromptEditPlaceholder')}
                rows={4}
                style={commonStyles.textarea}
                aria-label={translate('imagePromptLabel')}
            />
        </section>
      )}

      <button
        onClick={generateCampaignContent}
        disabled={isLoading || (includeImage && imageMode === 'edit' && !imageFile) || (includeImage && !imagePrompt.trim())}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? translate('creatingCampaign') : translate('generateCampaignButton')}
      </button>

      <OutputDisplay isLoading={isLoading} error={error} generatedOutputs={generatedOutputs} onCopy={onCopy} />
    </>
  );
};

const RecycleMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, setGeneratedImageUrl }) => {
  const [existingContent, setExistingContent] = useState<string>('');
  const [selectedRecycleOption, setSelectedRecycleOption] = useState<string>('summary');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('es');
  const [selectedTone, setSelectedTone] = useState<string>('detect');

  useEffect(() => {
    setGeneratedImageUrl(null); // Clear image when switching tabs/modes
  }, [setGeneratedImageUrl]);

  const generateRecycledContent = useCallback(async () => {
    if (!existingContent.trim()) {
      setError(translate('errorEmptyContentToRecycle'));
      return;
    }

    const recycleOptionDisplay = (currentLanguage === 'es' ? recycleOptions.find(opt => opt.value === selectedRecycleOption)?.label : recycleOptions.find(opt => opt.value === selectedRecycleOption)?.enLabel) || selectedRecycleOption;
    const languageDisplay = (currentLanguage === 'es' ? languages.find(lang => lang.value === selectedLanguage)?.label : languages.find(lang => lang.value === selectedLanguage)?.enLabel) || selectedLanguage;
    const toneDisplay = (currentLanguage === 'es' ? tones.find(t => t.value === selectedTone)?.label : tones.find(t => t.value === selectedTone)?.enLabel) || selectedTone;

    const prompt = `You are an expert in content transformation. Your task is to take an existing text and transform it according to the specified recycling option, tone, and language.

The output must be a JSON object with an 'outputs' property containing an array with a single object. This object must have 'platform' (indicating the type of recycling/destination) and 'content' properties.

Existing content: '${existingContent}'
Recycling option: '${recycleOptionDisplay}'
Output Language: ${languageDisplay}
Desired Tone: ${toneDisplay}

Example output format for a summary:
\`\`\`json
{
  "outputs": [
    { "platform": "Summary", "content": "Here is the concise summary of the existing content." }
  ]
}
\`\`\`
Now, generate the recycled content.`;

    // Adjust the output schema for RecycleMode to reflect a single output with a 'platform' that describes the transformation.
    const recycleOutputSchema = {
        type: Type.OBJECT,
        properties: {
          outputs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                platform: {
                  type: Type.STRING,
                  description: "Describes the type of recycled content (e.g., Summary, X Thread, IG Caption).",
                },
                content: {
                  type: Type.STRING,
                  description: "The transformed content.",
                },
              },
              required: ["platform", "content"],
              propertyOrdering: ["platform", "content"],
            },
            minItems: 1,
            maxItems: 1, // Expect only one item for recycling a single piece of content
          },
        },
        required: ["outputs"],
        propertyOrdering: ["outputs"],
      };

    await onGenerate(prompt, recycleOutputSchema);
  }, [existingContent, selectedRecycleOption, selectedLanguage, selectedTone, onGenerate, setError]);

  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">{translate('recycleModeTitle')}</h3>
        <p>{translate('recycleModeDesc')}</p>
        <label htmlFor="existingContent" style={commonStyles.label}>{translate('existingContentLabel')}</label>
        <textarea
          id="existingContent"
          value={existingContent}
          onChange={(e) => setExistingContent(e.target.value)}
          placeholder={translate('existingContentPlaceholder')}
          rows={8}
          style={commonStyles.textarea}
          aria-label={translate('existingContentLabel')}
        />
      </section>

      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label htmlFor="recycleOption" style={commonStyles.label}>{translate('recycleOptionLabel')}</label>
          <select
            id="recycleOption"
            value={selectedRecycleOption}
            onChange={(e) => setSelectedRecycleOption(e.target.value)}
            style={commonStyles.select}
            aria-label={translate('recycleOptionLabel')}
          >
            {recycleOptions.map(option => (
              <option key={option.value} value={option.value}>{currentLanguage === 'es' ? option.label : option.enLabel}</option>
            ))}
          </select>
        </div>

        <div style={commonStyles.configGroup}>
            <label htmlFor="languageSelectRecycle" style={commonStyles.label}>{translate('outputLanguageLabel')}</label>
            <select
              id="languageSelectRecycle"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              style={commonStyles.select}
              aria-label={translate('outputLanguageLabel')}
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>{currentLanguage === 'es' ? lang.label : lang.enLabel}</option>
              ))}
            </select>
          </div>

          <div style={commonStyles.configGroup}>
            <label htmlFor="toneSelectRecycle" style={commonStyles.label}>{translate('toneLabel')}</label>
            <select
              id="toneSelectRecycle"
              value={selectedTone}
              onChange={(e) => setSelectedTone(e.target.value)}
              style={commonStyles.select}
              aria-label={translate('toneLabel')}
            >
              {tones.map(tone => (
                <option key={tone.value} value={tone.value}>{currentLanguage === 'es' ? tone.label : tone.enLabel}</option>
              ))}
            </select>
          </div>
      </section>

      <button
        onClick={generateRecycledContent}
        disabled={isLoading}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? translate('recycling') : translate('recycleButton')}
      </button>

      <OutputDisplay isLoading={isLoading} error={error} generatedOutputs={generatedOutputs} onCopy={onCopy} />
    </>
  );
};

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const ChatMode: React.FC<Pick<CommonProps, 'onCopy' | 'setError' | 'setIsLoading' | 'isLoading' | 'error'>> = ({ onCopy, setError, setIsLoading, isLoading, error }) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentChatMessage, setCurrentChatMessage] = useState<string>('');
  const chatInstanceRef = useRef<Chat | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const initializeChat = useCallback(() => {
    if (chatInstanceRef.current) return; // Only initialize once
    try {
      if (!API_KEY) {
        throw new Error(translate('apiKeyNotFound'));
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      chatInstanceRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: currentLanguage === 'es' ? 'Eres un asistente de AncloraAdapt, útil y amigable, enfocado en ayudar a los usuarios con la creación y adaptación de contenido. Responde de forma concisa y directa.' : 'You are an AncloraAdapt assistant, helpful and friendly, focused on assisting users with content creation and adaptation. Respond concisely and directly.'
        }
      });
    } catch (err: any) {
      console.error(translate('chatErrorInit'), err);
      setError(translate('chatErrorInit') + `: ${err.message || translate('generalError')}`);
    }
  }, [setError]);

  useEffect(() => {
    initializeChat();
  }, [initializeChat]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);


  const sendChatMessage = useCallback(async () => {
    if (!currentChatMessage.trim()) return;
    if (!chatInstanceRef.current) {
        setError(translate('chatErrorInit'));
        return;
    }

    const userMessage: ChatMessage = { role: 'user', text: currentChatMessage };
    setChatHistory(prev => [...prev, userMessage]);
    setCurrentChatMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await chatInstanceRef.current.sendMessage({ message: userMessage.text });
      const aiResponseText = response.text;
      const aiMessage: ChatMessage = { role: 'model', text: aiResponseText };
      setChatHistory(prev => [...prev, aiMessage]);
    } catch (err: any) {
      console.error(translate('chatErrorResponse'), err);
      setError(translate('chatErrorResponse') + `: ${err.message || translate('generalError')}`);
    } finally {
      setIsLoading(false);
    }
  }, [currentChatMessage, setError, setIsLoading]);

  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">{translate('chatModeTitle')}</h3>
        <p>{translate('chatModeDesc')}</p>
        <div style={commonStyles.chatContainer} ref={chatContainerRef} aria-live="polite" aria-atomic="true">
          {chatHistory.length === 0 && !isLoading && (
            <p style={{textAlign: 'center', opacity: 0.7}}>{translate('chatEmptyMessage')}</p>
          )}
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              style={{
                ...commonStyles.chatMessage,
                ...(msg.role === 'user' ? commonStyles.userMessage : commonStyles.aiMessage)
              }}
              aria-label={`${msg.role} says ${msg.text}`}
            >
              {msg.text}
            </div>
          ))}
          {isLoading && (
            <div style={{ ...commonStyles.chatMessage, ...commonStyles.aiMessage }}>
              <span style={{opacity: 0.7}}>{translate('chatWriting')}</span>
            </div>
          )}
        </div>
        {error && (
          <div style={commonStyles.errorMessage} role="alert" aria-live="assertive">
            {error}
          </div>
        )}
        <div style={commonStyles.chatInputContainer}>
          <textarea
            value={currentChatMessage}
            onChange={(e) => setCurrentChatMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }}}
            placeholder={translate('chatInputPlaceholder')}
            rows={1}
            style={commonStyles.chatInput}
            aria-label={translate('chatInputPlaceholder')}
            disabled={isLoading}
          />
          <button
            onClick={sendChatMessage}
            style={commonStyles.chatButton}
            disabled={isLoading || !currentChatMessage.trim()}
            aria-label={translate('chatSendButton')}
          >
            {translate('chatSendButton')}
          </button>
        </div>
      </section>
    </>
  );
};


const TTSMode: React.FC<Pick<CommonProps, 'onCopy' | 'setError' | 'setIsLoading' | 'isLoading' | 'error'>> = ({ onCopy, setError, setIsLoading, isLoading, error }) => {
  const [textToSpeak, setTextToSpeak] = useState<string>('');
  const [selectedTTSLanguage, setSelectedTTSLanguage] = useState<string>('es');
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('Kore'); // Default voice for selected language
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({sampleRate: 24000});
    }
    return audioContextRef.current;
  }, []);

  useEffect(() => {
    // Update selectedVoiceName when selectedTTSLanguage changes to a default for that language
    const voicesForLang = ttsLanguageVoiceMap[selectedTTSLanguage as keyof typeof ttsLanguageVoiceMap];
    if (voicesForLang && voicesForLang.length > 0) {
      setSelectedVoiceName(voicesForLang[0].value); // Select first available voice
    } else {
      setSelectedVoiceName(''); // No voices for this language
    }
  }, [selectedTTSLanguage]);

  const generateSpeech = useCallback(async () => {
    if (!textToSpeak.trim()) {
      setError(translate('errorEmptyTextToSpeak'));
      return;
    }
    if (!selectedTTSLanguage || !selectedVoiceName) {
      setError(translate('errorNoLangOrVoiceSelected'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      if (!API_KEY) {
        throw new Error(translate('apiKeyNotFound'));
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      // First, translate the text to the selected TTS language
      const targetLanguageLabel = (currentLanguage === 'es' ? ttsLanguageOptions.find(lang => lang.value === selectedTTSLanguage)?.label : ttsLanguageOptions.find(lang => lang.value === selectedTTSLanguage)?.enLabel) || selectedTTSLanguage;
      const translationPrompt = `Translate the following text to ${targetLanguageLabel} and provide only the translated text, without additional comments or explanations: "${textToSpeak}"`;
      const translationResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Using a general model for translation
        contents: translationPrompt,
      });
      const translatedText = translationResponse.text.trim();

      if (!translatedText) {
          setError(translate('errorTranslationFailed'));
          setIsLoading(false);
          return;
      }

      // Then, generate speech from the translated text using the selected voice
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: translatedText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoiceName },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (base64Audio) {
        const audioBytes = decode(base64Audio);
        const audioContext = getAudioContext();
        
        // Temporarily decode and play for immediate feedback
        const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0); 

        // Create a WAV Blob for the audio element and download
        const wavBlob = createWavFile(audioBytes, 24000, 1, 16); // 16-bit PCM
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);

      } else {
        setError(translate('errorNoAudioReceived'));
      }

    } catch (err: any) {
      console.error(translate('errorGeneratingSpeech'), err);
      setError(translate('errorGeneratingSpeech') + `: ${err.message || translate('generalError')}.`);
    } finally {
      setIsLoading(false);
    }
  }, [textToSpeak, selectedTTSLanguage, selectedVoiceName, setError, setIsLoading, getAudioContext]);

  // Helper to create a WAV blob from raw PCM for browser <audio> tag compatibility
  const createWavFile = (pcmData: Uint8Array, sampleRate: number, numChannels: number, bitDepth: number) => {
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.byteLength;
    const fileSize = 44 + dataSize; // Corrected calculation: 44 bytes for WAV header

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer); // Fixed: Removed duplicate 'new'

    // RIFF chunk
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);
    writeString(view, 8, 'WAVE');

    // FMT chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunkSize
    view.setUint16(20, 1, true); // audioFormat (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // DATA chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < pcmData.length; i++, offset++) {
        view.setUint8(offset, pcmData[i]);
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const writeString = (view: DataView, offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
        view.setUint8(offset + i, s.charCodeAt(i));
    }
  };


  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">{translate('ttsModeTitle')}</h3>
        <p>{translate('ttsModeDesc')}</p>
        
        <label htmlFor="textToSpeak" style={commonStyles.label}>{translate('textToSpeakLabel')}</label>
        <textarea
          id="textToSpeak"
          value={textToSpeak}
          onChange={(e) => setTextToSpeak(e.target.value)}
          placeholder={translate('textToSpeakPlaceholder')}
          rows={6}
          style={commonStyles.textarea}
          aria-label={translate('textToSpeakLabel')}
        />
      </section>

      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label htmlFor="ttsLanguageSelect" style={commonStyles.label}>{translate('voiceLanguageLabel')}</label>
          <select
            id="ttsLanguageSelect"
            value={selectedTTSLanguage}
            onChange={(e) => setSelectedTTSLanguage(e.target.value)}
            style={commonStyles.select}
            aria-label={translate('voiceLanguageLabel')}
          >
            {ttsLanguageOptions.map(lang => (
              <option key={lang.value} value={lang.value}>{currentLanguage === 'es' ? lang.label : lang.enLabel}</option>
            ))}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label htmlFor="voiceNameSelect" style={commonStyles.label}>{translate('voiceLabel')}</label>
          <select
            id="voiceNameSelect"
            value={selectedVoiceName}
            onChange={(e) => setSelectedVoiceName(e.target.value)}
            style={commonStyles.select}
            aria-label={translate('voiceLabel')}
            disabled={!ttsLanguageVoiceMap[selectedTTSLanguage as keyof typeof ttsLanguageVoiceMap]?.length}
          >
            {ttsLanguageVoiceMap[selectedTTSLanguage as keyof typeof ttsLanguageVoiceMap]?.map(voice => (
              <option key={voice.value} value={voice.value}>{currentLanguage === 'es' ? voice.label : voice.enLabel}</option>
            ))}
            {!ttsLanguageVoiceMap[selectedTTSLanguage as keyof typeof ttsLanguageVoiceMap]?.length && (
              <option value="" disabled>{translate('noVoicesAvailable')}</option>
            )}
          </select>
        </div>
      </section>

      <button
        onClick={generateSpeech}
        disabled={isLoading || !textToSpeak.trim() || !selectedTTSLanguage || !selectedVoiceName}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? translate('generatingSpeech') : translate('generateSpeechButton')}
      </button>

      <OutputDisplay isLoading={isLoading} error={error} onCopy={onCopy} audioUrl={audioUrl} />
    </>
  );
};


// For Live API - assuming window.aistudio is available in the environment
// The coding guidelines state to assume window.aistudio is pre-configured and accessible.

const LiveChatMode: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [currentInputTranscription, setCurrentInputTranscription] = useState<string>('');
  const [currentOutputTranscription, setCurrentOutputTranscription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const playingSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // FIX: Moved stopRecording definition before startRecording
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close());
      sessionPromiseRef.current = null;
    }
    playingSourcesRef.current.forEach(source => source.stop());
    playingSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []); // Dependencies are stable, so empty array is fine

  const checkApiKey = useCallback(async () => {
    try {
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
        setHasApiKey(true);
        setApiKeyError(null);
      } else {
        setHasApiKey(false);
      }
    } catch (err) {
      console.error(translate('apiKeyErrorChecking'), err);
      setApiKeyError(translate('apiKeyErrorChecking'));
      setHasApiKey(false);
    }
  }, []);

  useEffect(() => {
    checkApiKey();
    return () => {
      // Cleanup on unmount
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (inputAudioContextRef.current) {
        inputAudioContextRef.current.close();
      }
      if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
      }
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
      }
      playingSourcesRef.current.forEach(source => source.stop());
    };
  }, [checkApiKey]);

  const requestApiKey = useCallback(async () => {
    try {
      await window.aistudio.openSelectKey();
      // Assume success after opening dialog, will be verified on next API call
      setHasApiKey(true);
      setApiKeyError(null);
    } catch (err) {
      console.error(translate('apiKeyErrorSelection'), err);
      setApiKeyError(translate('apiKeyErrorSelection'));
      setHasApiKey(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!hasApiKey) {
        setApiKeyError(translate('apiKeyRequiredMessage'));
        return;
    }
    setIsRecording(true);
    setTranscriptHistory([]);
    setCurrentInputTranscription('');
    setCurrentOutputTranscription('');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      inputAudioContextRef.current = new AudioContext({sampleRate: 16000});
      outputAudioContextRef.current = new AudioContext({sampleRate: 24000});
      nextStartTimeRef.current = 0;

      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      inputSourceRef.current = source; // Keep a ref to disconnect later

      const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor; // Keep a ref to disconnect later

      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        sessionPromiseRef.current?.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContextRef.current.destination);

      // It's crucial to create a new GoogleGenAI instance here to ensure it picks up the latest API key
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => { console.debug('Live session opened'); },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
              const audioContext = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);
              const audioBuffer = await decodeAudioData(
                decode(base64EncodedAudioString),
                audioContext,
                24000,
                1,
              );
              const audioSource = audioContext.createBufferSource();
              audioSource.buffer = audioBuffer;
              audioSource.connect(audioContext.destination);
              audioSource.addEventListener('ended', () => {
                playingSourcesRef.current.delete(audioSource);
              });

              audioSource.start(nextStartTimeRef.current);
              nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
              playingSourcesRef.current.add(audioSource);
            }

            // Handle transcription
            if (message.serverContent?.inputTranscription) {
              setCurrentInputTranscription(message.serverContent.inputTranscription.text);
            }
            if (message.serverContent?.outputTranscription) {
              setCurrentOutputTranscription(message.serverContent.outputTranscription.text);
            }
            if (message.serverContent?.turnComplete) {
              setTranscriptHistory(prev => [...prev, `${translate('liveUserPrefix')}${currentInputTranscription}`, `${translate('liveAIPrefix')}${currentOutputTranscription}`]);
              setCurrentInputTranscription('');
              setCurrentOutputTranscription('');
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              playingSourcesRef.current.forEach(source => source.stop());
              playingSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Live session error:', e);
            setError(translate('errorLiveSession', e.message || translate('generalError')) );
            stopRecording(); // Automatically stop on error
            // Check API key if error is "Requested entity was not found."
            if (e.message && e.message.includes("Requested entity was not found.")) {
                setApiKeyError(translate('apiKeyBillingError'));
                setHasApiKey(false);
            }
          },
          onclose: (e: CloseEvent) => { console.debug('Live session closed:', e); setIsRecording(false); },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Zephyr'}}, // Default voice
          },
          systemInstruction: currentLanguage === 'es' ? 'Eres un asistente de AncloraAdapt, útil y amigable, enfocado en ayudarte a crear y adaptar contenido en tiempo real. Responde de forma concisa y conversacional.' : 'You are an AncloraAdapt assistant, helpful and friendly, focused on helping you create and adapt content in real-time. Respond concisely and conversationally.'
        },
      });
    } catch (err: any) {
      console.error(translate('errorStartRecording'), err);
      setError(translate('errorStartRecording', err.message || translate('generalError')));
      setIsRecording(false);
    }
  }, [hasApiKey, currentInputTranscription, currentOutputTranscription, checkApiKey, stopRecording]);


  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">{translate('liveChatTitle')}</h3>
        <p>{translate('liveChatDesc')}</p>
        <div style={commonStyles.warningMessage}>
            <p><strong>{translate('liveChatWarning').split(':')[0]}:</strong> {translate('liveChatWarning').split(':')[1]} <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" style={{color: 'var(--warning-link-color)', textDecoration: 'underline'}}>{translate('billingInfo')}</a>.</p>
            {!hasApiKey && (
                <button onClick={requestApiKey} style={{...commonStyles.generateButton, width: 'auto', padding: '8px 15px', marginTop: '10px'}} aria-label={translate('selectApiKey')}>
                    {translate('selectApiKey')}
                </button>
            )}
            {apiKeyError && <p style={{color: '#e74c3c', marginTop: '10px'}}>{apiKeyError}</p>}
        </div>

        <div style={commonStyles.liveChatControl}>
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!hasApiKey}
              style={{ ...commonStyles.liveChatButton, ...commonStyles.startRecording }}
              aria-label={translate('startConversation')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-mic">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
              {translate('startConversation')}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              style={{ ...commonStyles.liveChatButton, ...commonStyles.stopRecording }}
              aria-label={translate('stopConversation')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-stop-circle">
                <circle cx="12" cy="12" r="10"></circle>
                <rect x="9" y="9" width="6" height="6"></rect>
              </svg>
              {translate('stopConversation')}
            </button>
          )}
        </div>

        {error && (
          <div style={commonStyles.errorMessage} role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <div style={commonStyles.liveTranscript} aria-live="polite">
            {transcriptHistory.map((line, index) => (
                <p key={index} style={line.startsWith(translate('liveUserPrefix')) ? commonStyles.liveTranscriptUser : commonStyles.liveTranscriptAI}>
                    {line}
                </p>
            ))}
            {isRecording && currentInputTranscription && (
                <p style={commonStyles.liveTranscriptUser}>{translate('liveUserPrefix')}{currentInputTranscription}</p>
            )}
            {isRecording && currentOutputTranscription && (
                <p style={commonStyles.liveTranscriptAI}>{translate('liveAIPrefix')}{currentOutputTranscription}</p>
            )}
            {!isRecording && transcriptHistory.length === 0 && (
                <p style={{textAlign: 'center', opacity: 0.7}}>{translate('liveTranscriptEmpty')}</p>
            )}
        </div>
      </section>
    </>
  );
};


const ImageEditMode: React.FC<Pick<CommonProps, 'onCopy' | 'setError' | 'setIsLoading' | 'isLoading' | 'error'>> = ({ onCopy, setError, setIsLoading, isLoading, error }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  // isLoading, error, onCopy, setError, setIsLoading are now received as props from App

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setEditedImageUrl(null); // Clear previous edited image
      setError(null);
    }
  };

  const editImage = useCallback(async () => {
    // We allow generation without a file, so only check for file if editing.
    if (!imagePrompt.trim()) {
      setError(translate('errorImagePromptEmpty'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setEditedImageUrl(null);

    try {
      if (!API_KEY) {
        throw new Error(translate('apiKeyNotFound'));
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      let contentsParts: any[] = [];

      // If a file is selected, include it for editing. Otherwise, it's a generation task.
      if (selectedFile) {
        const base64ImageData = await fileToBase64(selectedFile);
        contentsParts.push({
          inlineData: {
            data: base64ImageData,
            mimeType: selectedFile.type,
          },
        });
      }
      contentsParts.push({ text: imagePrompt });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', // This model supports both generation and editing based on context.
        contents: {
          parts: contentsParts,
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
      });

      const generatedImagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

      if (generatedImagePart?.inlineData) {
        const base64ImageBytes: string = generatedImagePart.inlineData.data;
        const imageUrl = `data:${generatedImagePart.inlineData.mimeType};base64,${base64ImageBytes}`;
        setEditedImageUrl(imageUrl);
      } else {
        setError(translate('errorNoImageReceived'));
      }

    } catch (err: any) {
      console.error(translate('errorGeneratingOrEditingImage', ''), err);
      setError(translate('errorGeneratingOrEditingImage', err.message || translate('generalError')));
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, imagePrompt, setError, setIsLoading]);

  return (
    <>
      <section style={commonStyles.section}>
        <h3 className="h3">{translate('imageEditModeTitle')}</h3>
        <p>{translate('imageEditModeDesc')}</p>
        <label htmlFor="imageUpload" style={commonStyles.label}>{translate('uploadImageOrGenerate')}</label>
        <input
          id="imageUpload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={commonStyles.fileInput}
          aria-label={translate('uploadImageOrGenerate')}
        />

        {previewUrl && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{fontSize: '1.2em', color: 'var(--azul-profundo)'}}>{translate('imagePreview')}</h4>
            <img src={previewUrl} alt={translate('imagePreview')} style={commonStyles.imagePreview} />
          </div>
        )}

        <label htmlFor="imagePrompt" style={commonStyles.label}>{translate('imagePromptEditGenerateLabel')}</label>
        <textarea
          id="imagePrompt"
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          placeholder={translate('imagePromptEditGeneratePlaceholder')}
          rows={4}
          style={commonStyles.textarea}
          aria-label={translate('imagePromptEditGenerateLabel')}
        />
      </section>

      <button
        onClick={editImage}
        disabled={isLoading || !imagePrompt.trim()}
        style={{ ...commonStyles.generateButton, ...(isLoading && commonStyles.generateButtonDisabled) }}
        className="generateButton"
        aria-live="polite"
      >
        {isLoading ? translate('processingImage') : translate('editGenerateImageButton')}
      </button>

      <OutputDisplay isLoading={isLoading} error={error} onCopy={onCopy} generatedImageUrl={editedImageUrl} />
    </>
  );
};

interface TutorialStep {
  title: string;
  description: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "tutorialTitleWelcome" as I18nKey,
    description: "tutorialDescWelcome" as I18nKey
  },
  {
    title: "tutorialTitleBasic" as I18nKey,
    description: "tutorialDescBasic" as I18nKey
  },
  {
    title: "tutorialTitleIntelligent" as I18nKey,
    description: "tutorialDescIntelligent" as I18nKey
  },
  {
    title: "tutorialTitleCampaign" as I18nKey,
    description: "tutorialDescCampaign" as I18nKey
  },
  {
    title: "tutorialTitleRecycle" as I18nKey,
    description: "tutorialDescRecycle" as I18nKey
  },
  {
    title: "tutorialTitleChat" as I18nKey,
    description: "tutorialDescChat" as I18nKey
  },
  {
    title: "tutorialTitleTTS" as I18nKey,
    description: "tutorialDescTTS" as I18nKey
  },
  {
    title: "tutorialTitleLiveChat" as I18nKey,
    description: "tutorialDescLiveChat" as I18nKey
  },
  {
    title: "tutorialTitleImage" as I18nKey,
    description: "tutorialDescImage" as I18nKey
  },
  {
    title: "tutorialTitleReady" as I18nKey,
    description: "tutorialDescReady" as I18nKey
  },
];

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  totalSteps: number;
  stepsContent: TutorialStep[];
}

const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, currentStep, onNext, onPrev, totalSteps, stepsContent }) => {
  if (!isOpen) return null;

  const currentStepContent = stepsContent[currentStep];

  return (
    <div style={commonStyles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div style={commonStyles.modalContent}>
        <button onClick={onClose} style={commonStyles.modalCloseButton} aria-label={translate('tutorialClose')}>×</button>
        <h2 id="tutorial-title" style={commonStyles.modalTitle}>{translate(currentStepContent.title as I18nKey)}</h2>
        <p style={commonStyles.modalDescription}>{translate(currentStepContent.description as I18nKey)}</p>
        <div style={commonStyles.modalNavigation}>
          <button
            onClick={onPrev}
            disabled={currentStep === 0}
            style={{ ...commonStyles.modalNavButton, ...(currentStep === 0 && commonStyles.modalNavButtonDisabled), ...commonStyles.modalNavButtonSecondary }}
            aria-label={translate('tutorialPrev')}
          >
            {translate('tutorialPrev')}
          </button>
          <span>{translate('tutorialStepCount', currentStep + 1, totalSteps)}</span>
          <button
            onClick={onNext}
            disabled={currentStep === totalSteps - 1}
            style={{ ...commonStyles.modalNavButton, ...(currentStep === totalSteps - 1 && commonStyles.modalNavButtonDisabled) }}
            aria-label={translate('tutorialNext')}
          >
            {translate('tutorialNext')}
          </button>
        </div>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [generatedOutputs, setGeneratedOutputs] = useState<GeneratedOutput[] | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null); // State for image URL
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [tutorialStep, setTutorialStep] = useState<number>(0);

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
      return savedTheme;
    }
    return 'system'; // Default
  });

  const [language, setLanguage] = useState<'es' | 'en'>(() => {
    const savedLang = localStorage.getItem('language');
    if (savedLang && (savedLang === 'es' || savedLang === 'en')) {
      return savedLang;
    }
    return 'es'; // Default to Spanish
  });

  // Update global language for i18n utility
  useEffect(() => {
    currentLanguage = language;
  }, [language]);


  useEffect(() => {
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme'); // Clear previous themes

    const applyTheme = (selectedTheme: 'light' | 'dark') => {
      body.classList.add(`${selectedTheme}-theme`);
    };

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(prefersDark.matches ? 'dark' : 'light');
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      prefersDark.addEventListener('change', listener);
      return () => prefersDark.removeEventListener('change', listener);
    } else {
      applyTheme(theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => {
      if (prevTheme === 'light') return 'dark';
      if (prevTheme === 'dark') return 'system';
      return 'light'; // From system to light
    });
  };

  const toggleLanguage = () => {
    setLanguage(prevLang => prevLang === 'es' ? 'en' : 'es');
  };

  const generateContentApiCall = useCallback(async (prompt: string, schema: any, model: string = "gemini-2.5-flash", config?: Record<string, any>) => {
    setIsLoading(true);
    setError(null);
    setGeneratedOutputs(null); // Clear previous outputs for text generation
    setGeneratedImageUrl(null); // Clear previous image output before text generation

    try {
      if (!API_KEY) {
        throw new Error(translate('apiKeyNotFound'));
      }
      const ai = new GoogleGenAI({ apiKey: API_KEY });

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          ...config, // Merge additional config like thinkingConfig
        },
      });

      const rawJsonString = response.text.trim();
      const parsedResponse = JSON.parse(rawJsonString);

      if (parsedResponse && Array.isArray(parsedResponse.outputs)) {
        setGeneratedOutputs(parsedResponse.outputs);
      } else {
        setError(translate('unexpectedResponseFormat'));
      }

    } catch (err: any) {
      console.error(translate('generalError', ''), err);
      setError(translate('generalError', err.message || translate('generalError')));
      setGeneratedOutputs(null); // Clear outputs on error
    } finally {
      // For modes that only do text generation, isLoading is set to false here.
      // For modes that also generate images, their functions will handle the final setIsLoading(false).
      if (!['intelligent', 'campaign'].includes(activeTab)) { // Assuming these are the only modes that generate images AFTER text
        setIsLoading(false);
      }
    }
  }, [setGeneratedOutputs, setGeneratedImageUrl, setError, setIsLoading, activeTab]);


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: Implement user feedback for copy success
  };

  const handleOpenTutorial = () => {
    setShowTutorial(true);
    setTutorialStep(0);
  };

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    setTutorialStep(0);
  };

  const handleNextTutorialStep = () => {
    setTutorialStep(prev => Math.min(prev + 1, tutorialSteps.length - 1));
  };

  const handlePrevTutorialStep = () => {
    setTutorialStep(prev => Math.max(prev - 1, 0));
  };


  const commonProps: CommonProps = {
    isLoading,
    error,
    generatedOutputs,
    onGenerate: generateContentApiCall,
    onCopy: copyToClipboard,
    setError,
    setIsLoading,
    setGeneratedImageUrl,
  };

  return (
    <div style={commonStyles.container}>
      <header style={commonStyles.header}>
        <h1 style={commonStyles.title}>{translate('appTitle')}</h1>
        <p style={commonStyles.subtitle}>{translate('appSubtitle')}</p>
        <div style={commonStyles.controlsWrapper}>
          <button onClick={toggleTheme} style={commonStyles.themeToggleButton} aria-label={`Toggle theme: ${theme}`}>
            {theme === 'light' && (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-sun"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            )}
            {theme === 'dark' && (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            )}
            {theme === 'system' && (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-monitor"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            )}
          </button>
          <button onClick={toggleLanguage} style={commonStyles.languageToggleButton} aria-label={`Change language to ${language === 'es' ? 'English' : 'Spanish'}`}>
            {language.toUpperCase()} | {language === 'es' ? 'EN' : 'ES'}
          </button>
          <button onClick={handleOpenTutorial} style={commonStyles.helpButton} aria-label={translate('helpButton')}>?</button>
        </div>
      </header>

      <main style={commonStyles.mainContent}>
        <nav style={commonStyles.tabNavigation} aria-label="Modos de la aplicación">
          <button
            onClick={() => { setActiveTab('basic'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); setIsLoading(false); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'basic' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'basic'}
            role="tab"
            tabIndex={activeTab === 'basic' ? 0 : -1}
          >
            {translate('basicTab')}
            {activeTab === 'basic' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('intelligent'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); setIsLoading(false); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'intelligent' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'intelligent'}
            role="tab"
            tabIndex={activeTab === 'intelligent' ? 0 : -1}
          >
            {translate('intelligentTab')}
            {activeTab === 'intelligent' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('campaign'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); setIsLoading(false); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'campaign' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'campaign'}
            role="tab"
            tabIndex={activeTab === 'campaign' ? 0 : -1}
          >
            {translate('campaignTab')}
            {activeTab === 'campaign' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('recycle'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); setIsLoading(false); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'recycle' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'recycle'}
            role="tab"
            tabIndex={activeTab === 'recycle' ? 0 : -1}
          >
            {translate('recycleTab')}
            {activeTab === 'recycle' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('chat'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); setIsLoading(false); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'chat' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'chat'}
            role="tab"
            tabIndex={activeTab === 'chat' ? 0 : -1}
          >
            {translate('chatTab')}
            {activeTab === 'chat' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('tts'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); setIsLoading(false); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'tts' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'tts'}
            role="tab"
            tabIndex={activeTab === 'tts' ? 0 : -1}
          >
            {translate('ttsTab')}
            {activeTab === 'tts' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('live_chat'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); setIsLoading(false); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'live_chat' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'live_chat'}
            role="tab"
            tabIndex={activeTab === 'live_chat' ? 0 : -1}
          >
            {translate('liveChatTab')}
            {activeTab === 'live_chat' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
          <button
            onClick={() => { setActiveTab('image_edit'); setGeneratedOutputs(null); setGeneratedImageUrl(null); setError(null); setIsLoading(false); }}
            style={{ ...commonStyles.tabButton, ...(activeTab === 'image_edit' && commonStyles.tabButtonActive) }}
            aria-selected={activeTab === 'image_edit'}
            role="tab"
            tabIndex={activeTab === 'image_edit' ? 0 : -1}
          >
            {translate('imageEditTab')}
            {activeTab === 'image_edit' && <span style={commonStyles.tabButtonActiveUnderline}></span>}
          </button>
        </nav>

        {activeTab === 'basic' && <BasicMode {...commonProps} />}
        {activeTab === 'intelligent' && <IntelligentMode {...commonProps} />}
        {activeTab === 'campaign' && <CampaignMode {...commonProps} />}
        {activeTab === 'recycle' && <RecycleMode {...commonProps} />}
        {activeTab === 'chat' && <ChatMode {...{ isLoading, error, onCopy: commonProps.onCopy, setError, setIsLoading }} />}
        {activeTab === 'tts' && <TTSMode {...{ isLoading, error, onCopy: commonProps.onCopy, setError, setIsLoading }} />}
        {activeTab === 'live_chat' && <LiveChatMode />}
        {activeTab === 'image_edit' && <ImageEditMode {...{ isLoading, error, onCopy: commonProps.onCopy, setError, setIsLoading }} />}
      </main>

      <TutorialModal
        isOpen={showTutorial}
        onClose={handleCloseTutorial}
        currentStep={tutorialStep}
        onNext={handleNextTutorialStep}
        onPrev={handlePrevTutorialStep}
        totalSteps={tutorialSteps.length}
        stepsContent={tutorialSteps}
      />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);