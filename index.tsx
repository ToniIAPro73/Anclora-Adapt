import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';

const API_KEY = process.env.HF_API_KEY || process.env.API_KEY;
const HF_BASE_URL_RAW = (import.meta.env.VITE_HF_BASE_URL || 'https://router.huggingface.co/hf-inference')
  .trim();
const HF_BASE_URL = HF_BASE_URL_RAW.replace(/\/+$/, '');
const isRouterBase = HF_BASE_URL.includes('router.huggingface.co');
const TEXT_MODEL_ID = import.meta.env.VITE_TEXT_MODEL_ID || 'meta-llama/Meta-Llama-3-8B-Instruct';
const IMAGE_MODEL_ID = import.meta.env.VITE_IMAGE_MODEL_ID || 'black-forest-labs/FLUX.1-schnell';
const TTS_MODEL_ID = import.meta.env.VITE_TTS_MODEL_ID || 'suno/bark-small';
const STT_MODEL_ID = import.meta.env.VITE_STT_MODEL_ID || 'openai/whisper-large-v3-turbo';
const proxyEnabled = import.meta.env.VITE_USE_PROXY === 'true' || import.meta.env.DEV;
const forceDirect = import.meta.env.VITE_USE_DIRECT_HF === 'true';
const useProxy = !forceDirect && proxyEnabled;
const resolveDirectEndpoint = (modelId: string) =>
  isRouterBase ? `${HF_BASE_URL}/models/${modelId}` : `${HF_BASE_URL}/models/${modelId}`;

const TEXT_ENDPOINT = useProxy ? '/api/hf-text' : resolveDirectEndpoint(TEXT_MODEL_ID);
const IMAGE_ENDPOINT = useProxy ? '/api/hf-image' : resolveDirectEndpoint(IMAGE_MODEL_ID);
const TTS_ENDPOINT = useProxy ? '/api/hf-tts' : resolveDirectEndpoint(TTS_MODEL_ID);
const STT_ENDPOINT = useProxy ? '/api/hf-stt' : resolveDirectEndpoint(STT_MODEL_ID);

const buildCandidateUrls = (modelId: string, proxyPath: string) => {
  const urls = new Set<string>();
  if (proxyPath) {
    urls.add(proxyPath);
  } else {
    urls.add(resolveDirectEndpoint(modelId));
  }
  return Array.from(urls);
};

const fetchWithFallback = async (urls: string[], options: RequestInit) => {
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      if (response.status === 404 || response.status === 410) {
        lastError = new Error(`${response.status} at ${url}`);
        continue;
      }
      const detail = await response.text();
      throw new Error(detail || `${response.status} at ${url}`);
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error('All endpoints failed');
};

type ThemeMode = 'light' | 'dark' | 'system';
type InterfaceLanguage = 'es' | 'en';

interface BlobLike {
  data: string;
  mimeType: string;
}

const ensureApiKey = () => {
  if (!API_KEY) {
    throw new Error('Define HF_API_KEY en tu .env.local');
  }
};

const callTextModel = async (prompt: string): Promise<string> => {
  ensureApiKey();
  const response = await fetchWithFallback(
    buildCandidateUrls(TEXT_MODEL_ID, useProxy ? TEXT_ENDPOINT : ''),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TEXT_MODEL_ID,
        inputs: prompt,
        parameters: {
          max_new_tokens: 800,
          temperature: 0.4,
          return_full_text: false,
        },
      }),
    },
  );

  const payload = await response.json();
  if (Array.isArray(payload)) {
    return payload[0]?.generated_text ?? '';
  }
  if (typeof payload?.generated_text === 'string') {
    return payload.generated_text;
  }
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
};

const callImageModel = async (prompt: string, base64Image?: string): Promise<string> => {
  ensureApiKey();
  const response = await fetchWithFallback(
    buildCandidateUrls(IMAGE_MODEL_ID, useProxy ? IMAGE_ENDPOINT : ''),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL_ID,
        inputs: prompt,
        image: base64Image,
        parameters: {
          guidance_scale: 3.5,
          num_inference_steps: 28,
        },
      }),
    },
  );
  const buffer = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
};

const callTextToSpeech = async (text: string, voicePreset: string): Promise<string> => {
  ensureApiKey();
  const response = await fetchWithFallback(
    buildCandidateUrls(TTS_MODEL_ID, useProxy ? TTS_ENDPOINT : ''),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TTS_MODEL_ID,
        inputs: text,
        parameters: { voice_preset: voicePreset },
      }),
    },
  );
  const buffer = await response.arrayBuffer();
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
};

const callSpeechToText = async (audioBlob: Blob): Promise<string> => {
  ensureApiKey();
  const response = await fetchWithFallback(
    buildCandidateUrls(STT_MODEL_ID, useProxy ? STT_ENDPOINT : ''),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': audioBlob.type || 'audio/wav',
      },
      body: audioBlob,
    },
  );
  const payload = await response.json();
  return payload?.text?.trim?.() ?? '';
};

const extractJsonPayload = (raw: string) => {
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1);
  }
  return raw;
};

const structuredOutputExample = `{
  "outputs": [
    { "platform": "LinkedIn", "content": "Version profesional" },
    { "platform": "Instagram", "content": "Copys breves y visuales" }
  ]
}`;

const formatCounterText = (value: string, language: InterfaceLanguage) => {
  const chars = value.length;
  const tokens = chars === 0 ? 0 : Math.max(1, Math.round(chars / 4));
  const charLabel = language === 'es' ? 'caracteres' : 'characters';
  const tokenLabel = language === 'es' ? 'tokens estimados' : 'estimated tokens';
  return `${chars} ${charLabel} · ~${tokens} ${tokenLabel}`;
};

interface GeneratedOutput {
  platform: string;
  content: string;
}

interface CommonProps {
  isLoading: boolean;
  error: string | null;
  generatedOutputs: GeneratedOutput[] | null;
  generatedImageUrl: string | null;
  onGenerate: (prompt: string) => Promise<void>;
  onCopy: (text: string) => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setGeneratedImageUrl: React.Dispatch<React.SetStateAction<string | null>>;
  interfaceLanguage: InterfaceLanguage;
}

const languages = [
  { value: 'detect', label: 'Detectar automatico' },
  { value: 'es', label: 'Espanol' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Francais' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Portugues' },
  { value: 'it', label: 'Italiano' },
  { value: 'zh', label: 'Chino' },
  { value: 'ja', label: 'Japones' },
  { value: 'ru', label: 'Ruso' },
];

const tones = [
  { value: 'detect', label: 'Detectar automatico' },
  { value: 'Profesional', label: 'Profesional' },
  { value: 'Amistoso', label: 'Amistoso' },
  { value: 'Formal', label: 'Formal' },
  { value: 'Casual', label: 'Casual' },
  { value: 'Motivador', label: 'Motivador' },
  { value: 'Emocional', label: 'Emocional' },
  { value: 'Directo', label: 'Directo' },
  { value: 'Creativo', label: 'Creativo' },
];

const recycleOptions = [
  { value: 'summary', label: 'Resumen conciso' },
  { value: 'x_thread', label: 'Hilo para X' },
  { value: 'instagram_caption', label: 'Caption para Instagram' },
  { value: 'title_hook', label: 'Titulo y gancho' },
  { value: 'key_points', label: 'Lista de puntos clave' },
  { value: 'email_launch', label: 'Email de lanzamiento' },
  { value: 'press_release', label: 'Nota de prensa' },
];

const ttsLanguageVoiceMap: Record<string, { value: string; label: string }[]> = {
  es: [
    { value: 'es_male_0', label: 'Mateo (ES)' },
    { value: 'es_female_0', label: 'Clara (ES)' },
  ],
  en: [
    { value: 'en_male_0', label: 'Noah (EN)' },
    { value: 'en_female_0', label: 'Ava (EN)' },
  ],
  fr: [
    { value: 'fr_male_0', label: 'Louis (FR)' },
    { value: 'fr_female_0', label: 'Chloe (FR)' },
  ],
  de: [
    { value: 'de_male_0', label: 'Felix (DE)' },
    { value: 'de_female_0', label: 'Lena (DE)' },
  ],
  pt: [
    { value: 'pt_male_0', label: 'Caio (PT)' },
    { value: 'pt_female_0', label: 'Marina (PT)' },
  ],
  it: [
    { value: 'it_male_0', label: 'Marco (IT)' },
    { value: 'it_female_0', label: 'Giulia (IT)' },
  ],
  zh: [
    { value: 'zh_male_0', label: 'Wei (ZH)' },
    { value: 'zh_female_0', label: 'Lan (ZH)' },
  ],
  ja: [
    { value: 'ja_male_0', label: 'Ren (JA)' },
    { value: 'ja_female_0', label: 'Yui (JA)' },
  ],
  ru: [
    { value: 'ru_male_0', label: 'Ivan (RU)' },
    { value: 'ru_female_0', label: 'Eva (RU)' },
  ],
  ar: [
    { value: 'ar_male_0', label: 'Omar (AR)' },
    { value: 'ar_female_0', label: 'Sara (AR)' },
  ],
};

const ttsLanguageOptions = [
  { value: 'es', label: 'Espanol' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Francais' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Portugues' },
  { value: 'it', label: 'Italiano' },
  { value: 'zh', label: 'Chino' },
  { value: 'ja', label: 'Japones' },
  { value: 'ru', label: 'Ruso' },
  { value: 'ar', label: 'Arabe' },
];

const themeIconProps: React.SVGProps<SVGSVGElement> = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const renderThemeIcon = (mode: ThemeMode): React.ReactElement => {
  switch (mode) {
    case 'light':
      return (
        <svg {...themeIconProps} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="3" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="21" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="3" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="21" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    case 'dark':
      return (
        <svg {...themeIconProps} aria-hidden="true">
          <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79z" />
        </svg>
      );
    default:
      return (
        <svg {...themeIconProps} aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <line x1="8" y1="20" x2="16" y2="20" />
          <line x1="12" y1="16" x2="12" y2="20" />
        </svg>
      );
  }
};

const translations: Record<InterfaceLanguage, {
  title: string;
  subtitle: string;
  help: string;
  helpTitle: string;
  helpTips: string[];
  tabs: { basic: string; intelligent: string; campaign: string; recycle: string; chat: string; tts: string; live: string; image: string };
  toggles: { themeLight: string; themeDark: string; themeSystem: string; langEs: string; langEn: string };
  output: { loading: string; downloadAudio: string; downloadImage: string; copy: string };
  basic: { ideaLabel: string; ideaPlaceholder: string; languageLabel: string; toneLabel: string; speedLabel: string; speedDetailed: string; speedFlash: string; platformLabel: string; literalLabel: string; maxCharsLabel: string; buttonIdle: string; buttonLoading: string; errors: { idea: string; platforms: string } };
  intelligent: { ideaLabel: string; ideaPlaceholder: string; contextLabel: string; contextPlaceholder: string; languageLabel: string; deepThinkingLabel: string; includeImageLabel: string; imagePromptLabel: string; imagePromptPlaceholder: string; buttonIdle: string; buttonLoading: string; errors: { idea: string; imagePrompt: string } };
  campaign: { ideaLabel: string; ideaPlaceholder: string; contextLabel: string; contextPlaceholder: string; languageLabel: string; buttonIdle: string; buttonLoading: string; errors: { idea: string } };
  recycle: { originalLabel: string; originalPlaceholder: string; contextLabel: string; contextPlaceholder: string; formatLabel: string; languageLabel: string; toneLabel: string; buttonIdle: string; buttonLoading: string; errors: { original: string } };
  chat: { intro: string; placeholder: string; button: string; typing: string };
  tts: { textLabel: string; textPlaceholder: string; languageLabel: string; voiceLabel: string; buttonIdle: string; buttonLoading: string; errors: { text: string } };
  live: { intro: string; buttonStart: string; buttonStop: string; transcriptLabel: string; errors: { microphone: string } };
  image: { promptLabel: string; promptPlaceholder: string; buttonIdle: string; buttonLoading: string; errors: { prompt: string } };
}> = {
  es: {
    title: 'AncloraAdapt',
    subtitle: 'Adapta, planifica y recicla contenido con modelos open source.',
    help: 'Explora cada modo, agrega contexto y prueba prompts cortos antes de compartirlos.',
    helpTitle: 'Guia rapida',
    helpTips: [
      'Completa el contexto/destino en cada modo para resultados mas precisos.',
      'Activa el proxy local (npm run dev) para evitar errores CORS con Hugging Face.',
      'Recuerda que la interfaz arranca en español; cambia a ingles con el toggle de idioma.',
    ],
    tabs: { basic: 'Basico', intelligent: 'Inteligente', campaign: 'Campaña', recycle: 'Reciclar', chat: 'Chat', tts: 'Voz', live: 'Live chat', image: 'Imagen' },
    toggles: {
      themeLight: 'Modo claro',
      themeDark: 'Modo oscuro',
      themeSystem: 'Seguir el modo del sistema',
      langEs: 'Interfaz en espanol',
      langEn: 'Interfaz en ingles',
    },
    output: {
      loading: 'La IA esta trabajando...',
      downloadAudio: 'Descargar audio',
      downloadImage: 'Descargar imagen',
      copy: 'Copiar',
    },
    basic: {
      ideaLabel: 'Tu idea principal',
      ideaPlaceholder: 'Quiero contar que...',
      languageLabel: 'Idioma',
      toneLabel: 'Tono',
      speedLabel: 'Velocidad',
      speedDetailed: 'Detallado',
      speedFlash: 'Flash',
      platformLabel: 'Plataformas',
      literalLabel: 'Forzar traduccion literal (sin tono ni plataformas)',
      maxCharsLabel: 'Maximo de caracteres',
      buttonIdle: 'Generar contenido',
      buttonLoading: 'Generando...',
      errors: {
        idea: 'Describe tu idea principal.',
        platforms: 'Selecciona al menos una plataforma.',
      },
    },
    intelligent: {
      ideaLabel: 'Describe tu necesidad',
      ideaPlaceholder: 'Necesito adaptar un anuncio...',
      contextLabel: 'Contexto / Destino',
      contextPlaceholder: 'Equipo de ventas, newsletter, etc.',
      languageLabel: 'Idioma de salida',
      deepThinkingLabel: 'Pensamiento profundo',
      includeImageLabel: 'Incluir imagen generada',
      imagePromptLabel: 'Prompt de imagen',
      imagePromptPlaceholder: 'Una ilustracion minimalista...',
      buttonIdle: 'Generar adaptaciones',
      buttonLoading: 'Interpretando...',
      errors: {
        idea: 'Describe lo que necesitas.',
        imagePrompt: 'Escribe el prompt para la imagen.',
      },
    },
    campaign: {
      ideaLabel: 'Idea central de la campaña',
      ideaPlaceholder: 'Ej: Lanzamiento express de...',
      contextLabel: 'Contexto / Destino',
      contextPlaceholder: 'Canales disponibles, presupuesto, etc.',
      languageLabel: 'Idioma de salida',
      buttonIdle: 'Generar campaña',
      buttonLoading: 'Construyendo campaña...',
      errors: {
        idea: 'Describe la idea base de tu campaña.',
      },
    },
    recycle: {
      originalLabel: 'Contenido original',
      originalPlaceholder: 'Pega el texto que quieres reciclar...',
      contextLabel: 'Contexto / Destino',
      contextPlaceholder: 'Donde se publicara, objetivo, etc.',
      formatLabel: 'Formato deseado',
      languageLabel: 'Idioma',
      toneLabel: 'Tono',
      buttonIdle: 'Reciclar contenido',
      buttonLoading: 'Reciclando...',
      errors: {
        original: 'Pega el contenido original.',
      },
    },
    chat: {
      intro: 'Conversa con AncloraAI para resolver dudas rapidas.',
      placeholder: 'Escribe tu mensaje...',
      button: 'Enviar',
      typing: 'Pensando...',
    },
    tts: {
      textLabel: 'Texto a convertir a voz',
      textPlaceholder: 'Hola, hoy lanzamos...',
      languageLabel: 'Idioma de la voz',
      voiceLabel: 'Selecciona la voz',
      buttonIdle: 'Generar voz',
      buttonLoading: 'Generando audio...',
      errors: {
        text: 'Escribe el texto a convertir.',
      },
    },
    live: {
      intro: 'Graba un fragmento corto y obten respuesta inmediata.',
      buttonStart: 'Hablar',
      buttonStop: 'Detener',
      transcriptLabel: 'Transcripcion',
      errors: {
        microphone: 'No se pudo acceder al microfono.',
      },
    },
    image: {
      promptLabel: 'Prompt de imagen',
      promptPlaceholder: 'Describe la escena que necesitas...',
      buttonIdle: 'Generar/Editar',
      buttonLoading: 'Procesando...',
      errors: {
        prompt: 'Escribe un prompt o sube una imagen.',
      },
    },
  },
  en: {
    title: 'AncloraAdapt',
    subtitle: 'Adapt, plan and recycle content with open-source models.',
    help: 'Explore each mode, add context and test short prompts before sharing.',
    helpTitle: 'Quick tips',
    helpTips: [
      'Fill the context/destination field to steer the generations.',
      'Use the local proxy (npm run dev) to avoid Hugging Face CORS issues.',
      'The UI defaults to Spanish; switch to English with the language toggle anytime.',
    ],
    tabs: { basic: 'Basic', intelligent: 'Intelligent', campaign: 'Campaign', recycle: 'Repurpose', chat: 'Chat', tts: 'Voice', live: 'Live chat', image: 'Image' },
    toggles: {
      themeLight: 'Light mode',
      themeDark: 'Dark mode',
      themeSystem: 'Match system theme',
      langEs: 'Interface in Spanish',
      langEn: 'Interface in English',
    },
    output: {
      loading: 'The AI is crafting your content...',
      downloadAudio: 'Download audio',
      downloadImage: 'Download image',
      copy: 'Copy',
    },
    basic: {
      ideaLabel: 'Your main idea',
      ideaPlaceholder: 'I want to announce...',
      languageLabel: 'Output language',
      toneLabel: 'Tone',
      speedLabel: 'Detail level',
      speedDetailed: 'Detailed',
      speedFlash: 'Flash',
      platformLabel: 'Platforms',
      literalLabel: 'Literal translation only (disable tone/platforms)',
      maxCharsLabel: 'Maximum characters',
      buttonIdle: 'Generate content',
      buttonLoading: 'Generating...',
      errors: {
        idea: 'Describe your main idea.',
        platforms: 'Select at least one platform.',
      },
    },
    intelligent: {
      ideaLabel: 'Describe your need',
      ideaPlaceholder: 'I need to adapt an offer...',
      contextLabel: 'Context / Destination',
      contextPlaceholder: 'Sales team, newsletter, etc.',
      languageLabel: 'Output language',
      deepThinkingLabel: 'Deep thinking',
      includeImageLabel: 'Include generated image',
      imagePromptLabel: 'Image prompt',
      imagePromptPlaceholder: 'A minimalist illustration...',
      buttonIdle: 'Generate adaptations',
      buttonLoading: 'Interpreting...',
      errors: {
        idea: 'Describe what you need.',
        imagePrompt: 'Provide the image prompt.',
      },
    },
    campaign: {
      ideaLabel: 'Campaign idea',
      ideaPlaceholder: 'Ex: Express launch for...',
      contextLabel: 'Context / Destination',
      contextPlaceholder: 'Available channels, budget, etc.',
      languageLabel: 'Output language',
      buttonIdle: 'Generate campaign',
      buttonLoading: 'Building campaign...',
      errors: {
        idea: 'Describe the core idea for the campaign.',
      },
    },
    recycle: {
      originalLabel: 'Original content',
      originalPlaceholder: 'Paste the text you want to repurpose...',
      contextLabel: 'Context / Destination',
      contextPlaceholder: 'Where will it be published?',
      formatLabel: 'Desired format',
      languageLabel: 'Language',
      toneLabel: 'Tone',
      buttonIdle: 'Repurpose content',
      buttonLoading: 'Repurposing...',
      errors: {
        original: 'Paste the original content.',
      },
    },
    chat: {
      intro: 'Chat with AncloraAI for quick guidance.',
      placeholder: 'Type your message...',
      button: 'Send',
      typing: 'Typing...',
    },
    tts: {
      textLabel: 'Text to convert',
      textPlaceholder: 'Hello, today we launch...',
      languageLabel: 'Voice language',
      voiceLabel: 'Voice',
      buttonIdle: 'Generate voice',
      buttonLoading: 'Generating audio...',
      errors: {
        text: 'Provide the text to convert.',
      },
    },
    live: {
      intro: 'Record a short snippet and get an instant reply.',
      buttonStart: 'Start talking',
      buttonStop: 'Stop',
      transcriptLabel: 'Transcript',
      errors: {
        microphone: 'Unable to access microphone.',
      },
    },
    image: {
      promptLabel: 'Image prompt',
      promptPlaceholder: 'Describe the scene you need...',
      buttonIdle: 'Generate/Edit',
      buttonLoading: 'Processing...',
      errors: {
        prompt: 'Write a prompt or upload an image.',
      },
    },
  },
};

const getStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'system';
  }
  const stored = window.localStorage.getItem('anclora.theme');
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
};

const getStoredLanguage = (): InterfaceLanguage => {
  if (typeof window === 'undefined') {
    return 'es';
  }
  const stored = window.localStorage.getItem('anclora.lang');
  return stored === 'en' ? 'en' : 'es';
};


const commonStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '30px 20px',
    maxWidth: '1200px',
    margin: '0 auto',
    gap: '30px',
  },
  header: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  headerTop: {
    textAlign: 'center',
  },
  headerControls: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  toggleGroup: {
    display: 'flex',
    gap: '8px',
    padding: '6px',
    borderRadius:
    '999px',
    backgroundColor: 'var(--toggle-track, var(--gris-fondo, #f6f7f9))',
    border: '1px solid var(--panel-border, #e0e0e0)',
  },
  toggleButton: {
    border: 'none',
    background: 'transparent',
    padding: '8px 14px',
    borderRadius: '999px',
    fontWeight: 600,
    color: 'var(--toggle-inactive-text, var(--texto, #162032))',
    opacity: 0.75,
    cursor: 'pointer',
    transition: 'color 0.2s ease, opacity 0.2s ease, background-color 0.2s ease',
  },
  toggleButtonActive: {
    backgroundColor: 'var(--toggle-active-bg, var(--blanco, #FFFFFF))',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    color: 'var(--toggle-active-text, var(--azul-claro, #2EAFC4))',
    opacity: 1,
  },
  title: {
    fontFamily: 'Libre Baskerville, serif',
    fontSize: '3em',
    margin: 0,
    color: 'var(--azul-profundo, #23436B)',
  },
  subtitle: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '1.1em',
    margin: 0,
    color: 'var(--texto, #162032)',
    opacity: 0.8,
  },
  mainContent: {
    width: '100%',
    backgroundColor: 'var(--panel-bg, #FFFFFF)',
    borderRadius: '18px',
    padding: '30px',
    boxShadow: 'var(--panel-shadow, 0 10px 40px rgba(0,0,0,0.06))',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px',
  },
  tabNavigation: {
    display: 'flex',
    flexWrap: 'wrap',
    borderBottom: '1px solid var(--panel-border, #e0e0e0)',
    gap: '10px',
    justifyContent: 'center',
  },
  tabButton: {
    background: 'transparent',
    border: 'none',
    padding: '12px 18px',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--texto, #162032)',
    opacity: 0.7,
  },
  tabButtonActive: {
    color: 'var(--azul-claro, #2EAFC4)',
    opacity: 1,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '0 12px 16px 12px',
    width: '100%',
    boxSizing: 'border-box',
  },
  label: {
    fontWeight: 600,
    color: 'var(--azul-profundo, #23436B)',
  },
  textarea: {
    width: '100%',
    minHeight: '120px',
    borderRadius: '10px',
    border: '1px solid var(--panel-border, #e0e0e0)',
    padding: '14px',
    fontSize: '1em',
    resize: 'vertical',
    backgroundColor: 'var(--input-bg, #FFFFFF)',
    color: 'var(--texto, #162032)',
  },
  select: {
    width: '100%',
    borderRadius: '10px',
    border: '1px solid var(--panel-border, #e0e0e0)',
    padding: '10px',
    backgroundColor: 'var(--input-bg, #FFFFFF)',
    color: 'var(--texto, #162032)',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontWeight: 600,
    color: 'var(--texto, #162032)',
  },
  configSection: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '20px',
    padding: '0 12px 16px 12px',
    width: '100%',
    boxSizing: 'border-box',
  },
  configGroup: {
    flex: '1 1 240px',
  },
  checkboxRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  checkboxChip: {
    padding: '6px 12px',
    borderRadius: '16px',
    backgroundColor: 'var(--chip-bg, #ecf0f1)',
    color: 'var(--chip-text, #162032)',
    border: '1px solid var(--panel-border, #e0e0e0)',
    cursor: 'pointer',
  },
  generateButton: {
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    backgroundImage: 'linear-gradient(90deg, var(--azul-claro, #2EAFC4), var(--ambar, #FFC979))',
    fontWeight: 700,
    color: 'var(--button-contrast, #162032)',
    cursor: 'pointer',
    margin: '0 12px',
  },
  errorMessage: {
    backgroundColor: 'var(--danger-bg, #fdecea)',
    color: 'var(--danger-text, #c0392b)',
    padding: '12px',
    borderRadius: '10px',
    margin: '0 12px',
  },
  loadingMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '4px solid rgba(0,0,0,0.1)',
    borderTop: '4px solid var(--azul-claro, #2EAFC4)',
    animation: 'spin 1s linear infinite',
  },
  outputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  outputGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  },
  outputCard: {
    border: '1px solid var(--panel-border, #e0e0e0)',
    borderRadius: '12px',
    padding: '18px',
    minHeight: '180px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    backgroundColor: 'var(--panel-bg, #FFFFFF)',
  },
  copyButton: {
    alignSelf: 'flex-end',
    border: '1px solid var(--azul-claro, #2EAFC4)',
    borderRadius: '8px',
    padding: '8px 12px',
    backgroundColor: 'var(--panel-bg, #FFFFFF)',
    color: 'var(--azul-claro, #2EAFC4)',
    cursor: 'pointer',
  },
  chatContainer: {
    border: '1px solid var(--panel-border, #e0e0e0)',
    borderRadius: '12px',
    padding: '20px 18px',
    minHeight: '360px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    backgroundColor: 'var(--panel-bg, #FFFFFF)',
    width: '100%',
    boxSizing: 'border-box',
  },
  chatMessage: {
    borderRadius: '14px',
    padding: '12px 14px',
    maxWidth: '80%',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.1)',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'var(--azul-claro, #2EAFC4)',
    color: 'var(--blanco, #FFFFFF)',
    marginLeft: '40px',
    marginRight: '4px',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'var(--chip-bg, #ecf0f1)',
    color: 'var(--chip-text, #162032)',
    marginRight: '40px',
    marginLeft: '4px',
  },
  chatInputWrapper: {
    width: '100%',
    padding: '0 12px 12px 12px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  chatInputRow: {
    display: 'flex',
    gap: '10px',
    width: '100%',
    alignItems: 'stretch',
  },
  chatTextInput: {
    flex: 1,
    borderRadius: '10px',
    border: '1px solid var(--panel-border, #e0e0e0)',
    padding: '10px',
    minHeight: '60px',
    backgroundColor: 'var(--input-bg, #FFFFFF)',
    color: 'var(--texto, #162032)',
    minWidth: 0,
    width: '100%',
  },
  chatCounters: {
    width: '100%',
    display: 'flex',
    justifyContent: 'flex-end',
    fontSize: '12px',
    color: 'var(--texto, #162032)',
    opacity: 0.85,
    paddingRight: '12px',
  },
  helpButton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '1px solid var(--azul-claro, #2EAFC4)',
    backgroundColor: 'var(--panel-bg, #FFFFFF)',
    color: 'var(--azul-claro, #2EAFC4)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  helpOverlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(15,23,42,0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    zIndex: 1000,
  },
  helpModal: {
    backgroundColor: 'var(--panel-bg, #FFFFFF)',
    borderRadius: '16px',
    padding: '24px',
    width: 'min(520px, 90vw)',
    boxShadow: '0 25px 65px rgba(15, 23, 42, 0.35)',
    border: '1px solid var(--panel-border, #e0e0e0)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  helpModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  helpModalList: {
    margin: 0,
    paddingLeft: '18px',
    color: 'var(--texto, #162032)',
  },
  helpCloseButton: {
    border: 'none',
    background: 'transparent',
    fontSize: '24px',
    cursor: 'pointer',
    color: 'var(--texto, #162032)',
  },
  helpIntro: {
    margin: 0,
    color: 'var(--texto, #162032)',
    opacity: 0.8,
  },
  inputCounter: {
    alignSelf: 'flex-end',
    fontSize: '12px',
    color: 'var(--toggle-inactive-text, #667085)',
    marginTop: '4px',
    paddingRight: '12px',
  },
  liveTranscript: {
    border: '1px solid var(--panel-border, #e0e0e0)',
    borderRadius: '12px',
    padding: '12px',
    minHeight: '120px',
    backgroundColor: 'var(--muted-surface, #f7f9fb)',
  },
  audioPlayer: {
    width: '100%',
    marginTop: '10px',
  },
};

const ensureGlobalStyles = () => {
  const existing = document.getElementById('anclora-global-styles');
  if (existing) return;
  const sheet = document.createElement('style');
  sheet.id = 'anclora-global-styles';
  sheet.innerHTML = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
  document.head.appendChild(sheet);
};
const OutputDisplay: React.FC<{
  generatedOutputs: GeneratedOutput[] | null;
  error: string | null;
  isLoading: boolean;
  onCopy: (text: string) => void;
  audioUrl?: string | null;
  imageUrl?: string | null;
  interfaceLanguage: InterfaceLanguage;
}> = ({ generatedOutputs, error, isLoading, onCopy, audioUrl, imageUrl, interfaceLanguage }) => {
  const copy = translations[interfaceLanguage].output;
  return (
    <section style={commonStyles.outputSection}>
      {error && <div style={commonStyles.errorMessage}>{error}</div>}
      {isLoading && (
        <div style={commonStyles.loadingMessage}>
          <div style={commonStyles.spinner}></div>
          <span>{copy.loading}</span>
        </div>
      )}
      {audioUrl && (
        <div>
          <audio controls style={commonStyles.audioPlayer} src={audioUrl}></audio>
          <a href={audioUrl} download="anclora_audio.wav" style={commonStyles.copyButton}>{copy.downloadAudio}</a>
        </div>
      )}
      {imageUrl && (
        <div>
          <img src={imageUrl} alt="Imagen generada" style={{ width: '100%', borderRadius: '12px' }} />
          <a href={imageUrl} download="anclora_image.png" style={commonStyles.copyButton}>{copy.downloadImage}</a>
        </div>
      )}
      {generatedOutputs && generatedOutputs.length > 0 && (
        <div style={commonStyles.outputGrid}>
          {generatedOutputs.map((output, index) => (
            <div key={index} style={commonStyles.outputCard}>
              <strong>{output.platform}</strong>
              <p>{output.content}</p>
              <button type="button" style={commonStyles.copyButton} onClick={() => onCopy(output.content)}>
                {copy.copy}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
const BasicMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl, interfaceLanguage }) => {
  const copy = translations[interfaceLanguage].basic;
  const [idea, setIdea] = useState('');
  const [language, setLanguage] = useState('es');
  const [tone, setTone] = useState('detect');
  const [platforms, setPlatforms] = useState<string[]>(['LinkedIn', 'Instagram']);
  const [speed, setSpeed] = useState<'detailed' | 'flash'>('detailed');
  const [literalTranslation, setLiteralTranslation] = useState(false);
  const [maxChars, setMaxChars] = useState('');

  useEffect(() => setGeneratedImageUrl(null), [setGeneratedImageUrl]);
  useEffect(() => setLanguage(interfaceLanguage), [interfaceLanguage]);

  const togglePlatform = (value: string) => {
    setPlatforms(prev => prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]);
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
    const languageDisplay = languages.find(l => l.value === language)?.label || language;
    const toneDisplay = tones.find(t => t.value === tone)?.label || tone;
    const speedDisplay = speed === 'detailed' ? copy.speedDetailed : copy.speedFlash;
    const parsedLimit = Number.parseInt(maxChars, 10);
    const charLimit = Number.isNaN(parsedLimit) ? null : parsedLimit;
    const limitSuffix = charLimit && charLimit > 0 ? ` Limita la respuesta a un maximo de ${charLimit} caracteres.` : '';
    let prompt: string;
    if (literalTranslation) {
      prompt = `Actua como traductor literal especializado en marketing. Devuelve la traduccion en formato JSON bajo la clave "outputs" siguiendo ${structuredOutputExample}. Texto original: "${idea}". Idioma de destino: ${languageDisplay}.${limitSuffix}`;
    } else {
      prompt = `Eres un estratega de contenidos. Genera una lista JSON bajo la clave "outputs" siguiendo ${structuredOutputExample}. Idea: "${idea}". Idioma solicitado: ${languageDisplay}. Tono: ${toneDisplay}. Plataformas: ${platforms.join(', ')}. Nivel de detalle: ${speedDisplay}.${limitSuffix}`;
    }
    await onGenerate(prompt);
  };

  return (
    <>
      <section style={commonStyles.section}>
        <label style={commonStyles.label} htmlFor="basic-idea">{copy.ideaLabel}</label>
        <textarea id="basic-idea" style={commonStyles.textarea} value={idea} onChange={e => setIdea(e.target.value)} placeholder={copy.ideaPlaceholder} />
        <div style={commonStyles.inputCounter}>{formatCounterText(idea, interfaceLanguage)}</div>
      </section>
      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{copy.languageLabel}</label>
          <select style={commonStyles.select} value={language} onChange={e => setLanguage(e.target.value)}>
            {languages.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{copy.toneLabel}</label>
          <select style={commonStyles.select} value={tone} onChange={e => setTone(e.target.value)} disabled={literalTranslation}>
            {tones.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{copy.speedLabel}</label>
          <select style={commonStyles.select} value={speed} onChange={e => setSpeed(e.target.value as 'detailed' | 'flash')}>
            <option value="detailed">{copy.speedDetailed}</option>
            <option value="flash">{copy.speedFlash}</option>
          </select>
        </div>
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>{copy.platformLabel}</label>
        <div style={commonStyles.checkboxRow}>
          {['LinkedIn', 'X', 'Instagram', 'WhatsApp', 'Email'].map(option => (
            <label key={option} style={{ ...commonStyles.checkboxChip, opacity: literalTranslation ? 0.5 : 1, cursor: literalTranslation ? 'not-allowed' : 'pointer' }}>
              <input type="checkbox" checked={platforms.includes(option)} onChange={() => togglePlatform(option)} disabled={literalTranslation} /> {option}
            </label>
          ))}
        </div>
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.checkboxLabel}>
          <input type="checkbox" checked={literalTranslation} onChange={e => setLiteralTranslation(e.target.checked)} /> {copy.literalLabel}
        </label>
      </section>
      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{copy.maxCharsLabel}</label>
          <input
            type="number"
            min="0"
            style={{ ...commonStyles.select, opacity: literalTranslation ? 0.6 : 1 }}
            value={maxChars}
            onChange={e => setMaxChars(e.target.value)}
            placeholder="280"
            disabled={literalTranslation}
          />
        </div>
      </section>
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? copy.buttonLoading : copy.buttonIdle}
      </button>
      <OutputDisplay generatedOutputs={generatedOutputs} error={error} isLoading={isLoading} onCopy={onCopy} audioUrl={null} imageUrl={generatedImageUrl} interfaceLanguage={interfaceLanguage} />
    </>
  );
};

const IntelligentMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl, interfaceLanguage }) => {
  const copy = translations[interfaceLanguage].intelligent;
  const [idea, setIdea] = useState('');
  const [context, setContext] = useState('');
  const [language, setLanguage] = useState(interfaceLanguage);
  const [deepThinking, setDeepThinking] = useState(false);
  const [includeImage, setIncludeImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => setGeneratedImageUrl(null), [setGeneratedImageUrl]);
  useEffect(() => setLanguage(interfaceLanguage), [interfaceLanguage]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError(copy.errors.idea);
      return;
    }
    if (includeImage && !imagePrompt.trim()) {
      setError(copy.errors.imagePrompt);
      return;
    }
    setIsLoading(true);
    setGeneratedImageUrl(null);
    try {
      const thinking = deepThinking ? 'Analiza paso a paso antes de responder.' : 'Responde de forma directa.';
      const languageDisplay = languages.find(l => l.value === language)?.label || language;
      const prompt = `Eres un estratega creativo. Necesidad: "${idea}". Contexto/destino: "${context || 'No especificado'}". Idioma del usuario: ${interfaceLanguage.toUpperCase()}. Idioma de salida solicitado: ${languageDisplay}. ${thinking} Sigue el formato ${structuredOutputExample}.`;
      await onGenerate(prompt);
      if (includeImage && imagePrompt.trim()) {
        const base64 = imageFile ? await fileToBase64(imageFile) : undefined;
        const imageUrl = await callImageModel(`${imagePrompt}
Contexto: ${context || idea}`, base64);
        setGeneratedImageUrl(imageUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error general: ${message}.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>{copy.ideaLabel}</label>
        <textarea style={commonStyles.textarea} value={idea} onChange={e => setIdea(e.target.value)} placeholder={copy.ideaPlaceholder} />
        <div style={commonStyles.inputCounter}>{formatCounterText(idea, interfaceLanguage)}</div>
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>{copy.contextLabel}</label>
        <textarea style={commonStyles.textarea} value={context} onChange={e => setContext(e.target.value)} placeholder={copy.contextPlaceholder} />
        <div style={commonStyles.inputCounter}>{formatCounterText(context, interfaceLanguage)}</div>
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>{copy.languageLabel}</label>
        <select style={commonStyles.select} value={language} onChange={e => setLanguage(e.target.value)}>
          {languages.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
        </select>
      </section>
      <section style={commonStyles.section}>
        <label>
          <input type="checkbox" checked={deepThinking} onChange={e => setDeepThinking(e.target.checked)} /> {copy.deepThinkingLabel}
        </label>
      </section>
      <section style={commonStyles.section}>
        <label>
          <input type="checkbox" checked={includeImage} onChange={e => setIncludeImage(e.target.checked)} /> {copy.includeImageLabel}
        </label>
        {includeImage && (
          <>
            <input type="file" onChange={handleFileChange} accept="image/*" />
            <textarea style={commonStyles.textarea} value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder={copy.imagePromptPlaceholder} />
            <div style={commonStyles.inputCounter}>{formatCounterText(imagePrompt, interfaceLanguage)}</div>
            {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: '12px' }} />}
          </>
        )}
      </section>
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? copy.buttonLoading : copy.buttonIdle}
      </button>
      <OutputDisplay generatedOutputs={generatedOutputs} error={error} isLoading={isLoading} onCopy={onCopy} audioUrl={null} imageUrl={generatedImageUrl} interfaceLanguage={interfaceLanguage} />
    </>
  );
};


const CampaignMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl, interfaceLanguage }) => {
  const copy = translations[interfaceLanguage].campaign;
  const [idea, setIdea] = useState('');
  const [context, setContext] = useState('');
  const campaignPlatforms = ['LinkedIn', 'X', 'Instagram', 'Email'];
  const [language, setLanguage] = useState('es');

  useEffect(() => setGeneratedImageUrl(null), [setGeneratedImageUrl]);
  useEffect(() => setLanguage(interfaceLanguage), [interfaceLanguage]);

  const handleGenerate = async () => {
    if (!idea.trim()) {
      setError(copy.errors.idea);
      return;
    }
    setIsLoading(true);
    setGeneratedImageUrl(null);
    try {
      const languageDisplay = languages.find(l => l.value === language)?.label || language;
      const prompt = `Eres un planificador de campañas express. Idea: "${idea}". Contexto/destino: "${context || 'No especificado'}". Idioma: ${languageDisplay}. Plataformas: ${campaignPlatforms.join(', ')}. Sigue el esquema ${structuredOutputExample}.`;
      await onGenerate(prompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>{copy.ideaLabel}</label>
        <textarea style={commonStyles.textarea} value={idea} onChange={e => setIdea(e.target.value)} placeholder={copy.ideaPlaceholder} />
        <div style={commonStyles.inputCounter}>{formatCounterText(idea, interfaceLanguage)}</div>
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>{copy.contextLabel}</label>
        <textarea style={commonStyles.textarea} value={context} onChange={e => setContext(e.target.value)} placeholder={copy.contextPlaceholder} />
        <div style={commonStyles.inputCounter}>{formatCounterText(context, interfaceLanguage)}</div>
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>{copy.languageLabel}</label>
        <select style={commonStyles.select} value={language} onChange={e => setLanguage(e.target.value)}>
          {languages.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
        </select>
      </section>
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? copy.buttonLoading : copy.buttonIdle}
      </button>
      <OutputDisplay generatedOutputs={generatedOutputs} error={error} isLoading={isLoading} onCopy={onCopy} audioUrl={null} imageUrl={generatedImageUrl} interfaceLanguage={interfaceLanguage} />
    </>
  );
};


const RecycleMode: React.FC<CommonProps> = ({ isLoading, error, generatedOutputs, onGenerate, onCopy, setError, setIsLoading, generatedImageUrl, setGeneratedImageUrl, interfaceLanguage }) => {
  const copy = translations[interfaceLanguage].recycle;
  const [inputText, setInputText] = useState('');
  const [context, setContext] = useState('');
  const [language, setLanguage] = useState('es');
  const [tone, setTone] = useState('detect');
  const [format, setFormat] = useState('summary');

  useEffect(() => setGeneratedImageUrl(null), [setGeneratedImageUrl]);
  useEffect(() => setLanguage(interfaceLanguage), [interfaceLanguage]);

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      setError(copy.errors.original);
      return;
    }
    setIsLoading(true);
    try {
      const languageDisplay = languages.find(l => l.value === language)?.label || language;
      const toneDisplay = tones.find(t => t.value === tone)?.label || tone;
      const formatDisplay = recycleOptions.find(opt => opt.value === format)?.label || format;
      const prompt = `Actua como editor. Formato: ${formatDisplay}. Idioma: ${languageDisplay}. Tono: ${toneDisplay}. Contexto/destino: ${context || 'No especificado'}. Convierte el siguiente texto manteniendo la coherencia y responde usando ${structuredOutputExample}. Texto: "${inputText}".`;
      await onGenerate(prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>{copy.originalLabel}</label>
        <textarea style={commonStyles.textarea} value={inputText} onChange={e => setInputText(e.target.value)} placeholder={copy.originalPlaceholder} />
        <div style={commonStyles.inputCounter}>{formatCounterText(inputText, interfaceLanguage)}</div>
      </section>
      <section style={commonStyles.section}>
        <label style={commonStyles.label}>{copy.contextLabel}</label>
        <textarea style={commonStyles.textarea} value={context} onChange={e => setContext(e.target.value)} placeholder={copy.contextPlaceholder} />
        <div style={commonStyles.inputCounter}>{formatCounterText(context, interfaceLanguage)}</div>
      </section>
      <section style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{copy.formatLabel}</label>
          <select style={commonStyles.select} value={format} onChange={e => setFormat(e.target.value)}>
            {recycleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{copy.languageLabel}</label>
          <select style={commonStyles.select} value={language} onChange={e => setLanguage(e.target.value)}>
            {languages.map(lang => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{copy.toneLabel}</label>
          <select style={commonStyles.select} value={tone} onChange={e => setTone(e.target.value)}>
            {tones.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </section>
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? copy.buttonLoading : copy.buttonIdle}
      </button>
      <OutputDisplay generatedOutputs={generatedOutputs} error={error} isLoading={isLoading} onCopy={onCopy} audioUrl={null} imageUrl={generatedImageUrl} interfaceLanguage={interfaceLanguage} />
    </>
  );
};

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}


const ChatMode: React.FC<{ interfaceLanguage: InterfaceLanguage; onCopy: (text: string) => void; }> = ({ interfaceLanguage, onCopy }) => {
  const copy = translations[interfaceLanguage].chat;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [current, setCurrent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!current.trim()) return;
    const updated = [...messages, { role: 'user', text: current }];
    setMessages(updated);
    setCurrent('');
    setIsLoading(true);
    try {
      const history = updated.map(msg => `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.text}`).join('\\n');
      const prompt = `Eres AncloraAI, enfocado en adaptacion de contenido. Idioma preferido: ${interfaceLanguage.toUpperCase()}. Conversacion: ${history}. Responde de forma breve.`;
      const raw = await callTextModel(prompt);
      const reply = raw.trim();
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Hubo un error al consultar el modelo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section style={commonStyles.section}>
      <p>{copy.intro}</p>
      <div style={commonStyles.chatContainer}>
        {messages.map((msg, index) => (
          <div key={index} style={{ ...commonStyles.chatMessage, ...(msg.role === 'user' ? commonStyles.userMessage : commonStyles.aiMessage) }}>
            {msg.text}
            {msg.role === 'assistant' && (
              <button style={commonStyles.copyButton} onClick={() => onCopy(msg.text)}>{translations[interfaceLanguage].output.copy}</button>
            )}
          </div>
        ))}
        {isLoading && <div style={{ ...commonStyles.chatMessage, ...commonStyles.aiMessage }}>{copy.typing}</div>}
      </div>
      <div style={commonStyles.chatInputRow}>
        <textarea style={commonStyles.chatTextInput} value={current} onChange={e => setCurrent(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder={copy.placeholder} />
        <button type="button" style={commonStyles.generateButton} onClick={sendMessage} disabled={isLoading}>{copy.button}</button>
      </div>
      <div style={commonStyles.chatCounters}>
        <span>{formatCounterText(current, interfaceLanguage)}</span>
      </div>
    </section>
  );
};


const TTSMode: React.FC<{ interfaceLanguage: InterfaceLanguage }> = ({ interfaceLanguage }) => {
  const copy = translations[interfaceLanguage].tts;
  const [textToSpeak, setTextToSpeak] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('es');
  const [selectedVoiceName, setSelectedVoiceName] = useState('es_male_0');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const voices = ttsLanguageVoiceMap[selectedLanguage];
    if (voices && voices.length) {
      setSelectedVoiceName(voices[0].value);
    }
  }, [selectedLanguage]);

  const handleGenerate = async () => {
    if (!textToSpeak.trim()) {
      setError(copy.errors.text);
      return;
    }
    setIsLoading(true);
    setError(null);
    setAudioUrl(null);
    try {
      const translationPrompt = `Traduce el siguiente texto al idioma de la voz (${selectedLanguage}) y responde solo con el texto traducido: "${textToSpeak}".`;
      const translated = (await callTextModel(translationPrompt)).trim();
      const audio = await callTextToSpeech(translated || textToSpeak, selectedVoiceName);
      setAudioUrl(audio);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section style={commonStyles.section}>
      <label style={commonStyles.label}>{copy.textLabel}</label>
      <textarea style={commonStyles.textarea} value={textToSpeak} onChange={e => setTextToSpeak(e.target.value)} placeholder={copy.textPlaceholder} />
      <div style={commonStyles.inputCounter}>{formatCounterText(textToSpeak, interfaceLanguage)}</div>
      <div style={commonStyles.configSection}>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{copy.languageLabel}</label>
          <select style={commonStyles.select} value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)}>
            {ttsLanguageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div style={commonStyles.configGroup}>
          <label style={commonStyles.label}>{copy.voiceLabel}</label>
          <select style={commonStyles.select} value={selectedVoiceName} onChange={e => setSelectedVoiceName(e.target.value)}>
            {(ttsLanguageVoiceMap[selectedLanguage] || []).map(voice => <option key={voice.value} value={voice.value}>{voice.label}</option>)}
          </select>
        </div>
      </div>
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? copy.buttonLoading : copy.buttonIdle}
      </button>
      {error && <div style={commonStyles.errorMessage}>{error}</div>}
      {audioUrl && (
        <div>
          <audio controls style={commonStyles.audioPlayer} src={audioUrl}></audio>
          <a href={audioUrl} download="anclora_tts.wav" style={commonStyles.copyButton}>{translations[interfaceLanguage].output.downloadAudio}</a>
        </div>
      )}
    </section>
  );
};


const LiveChatMode: React.FC<{ interfaceLanguage: InterfaceLanguage }> = ({ interfaceLanguage }) => {
  const copy = translations[interfaceLanguage].live;
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = evt => chunksRef.current.push(evt.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleConversation(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError(copy.errors.microphone);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleConversation = async (audioBlob: Blob) => {
    try {
      const userText = await callSpeechToText(audioBlob);
      setTranscript(prev => [...prev, { role: 'user', text: userText }]);
      const prompt = `Convierte el siguiente texto del usuario en una respuesta breve y accionable enfocada en marketing: "${userText}".`;
      const reply = (await callTextModel(prompt)).trim();
      setTranscript(prev => [...prev, { role: 'assistant', text: reply }]);
      const audioResponse = await callTextToSpeech(reply, 'es_male_0');
      setAudioUrl(audioResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  return (
    <section style={commonStyles.section}>
      <p>{copy.intro}</p>
      <button type="button" style={commonStyles.generateButton} onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? copy.buttonStop : copy.buttonStart}
      </button>
      {error && <div style={commonStyles.errorMessage}>{error}</div>}
      <div style={commonStyles.liveTranscript}>
        {transcript.map((msg, index) => (
          <p key={index}><strong>{msg.role === 'user' ? 'Tu' : 'AncloraAI'}:</strong> {msg.text}</p>
        ))}
        {transcript.length === 0 && <p>{copy.transcriptLabel}</p>}
      </div>
      {audioUrl && (
        <div>
          <audio src={audioUrl} controls style={commonStyles.audioPlayer}></audio>
          <a href={audioUrl} download="anclora_live.wav" style={commonStyles.copyButton}>{translations[interfaceLanguage].output.downloadAudio}</a>
        </div>
      )}
    </section>
  );
};


const ImageEditMode: React.FC<{ interfaceLanguage: InterfaceLanguage }> = ({ interfaceLanguage }) => {
  const copy = translations[interfaceLanguage].image;
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0] || null;
    setFile(image);
    setPreview(image ? URL.createObjectURL(image) : null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !file) {
      setError(copy.errors.prompt);
      return;
    }
    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    try {
      const base64 = file ? await fileToBase64(file) : undefined;
      const url = await callImageModel(prompt || 'Nueva composicion', base64);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section style={commonStyles.section}>
      <label style={commonStyles.label}>{copy.promptLabel}</label>
      <textarea style={commonStyles.textarea} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={copy.promptPlaceholder} />
      <div style={commonStyles.inputCounter}>{formatCounterText(prompt, interfaceLanguage)}</div>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {preview && <img src={preview} alt="preview" style={{ width: '100%', borderRadius: '12px' }} />}
      <button type="button" style={commonStyles.generateButton} onClick={handleGenerate} disabled={isLoading}>
        {isLoading ? copy.buttonLoading : copy.buttonIdle}
      </button>
      {error && <div style={commonStyles.errorMessage}>{error}</div>}
      {imageUrl && (
        <div>
          <img src={imageUrl} alt="Resultado" style={{ width: '100%', borderRadius: '12px' }} />
          <a href={imageUrl} download="anclora_image.png" style={commonStyles.copyButton}>{translations[interfaceLanguage].output.downloadImage}</a>
        </div>
      )}
    </section>
  );
};


const App: React.FC = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredTheme());
  const [interfaceLanguage, setInterfaceLanguage] = useState<InterfaceLanguage>(() => getStoredLanguage());
  const [activeTab, setActiveTab] = useState('basic');
  const [generatedOutputs, setGeneratedOutputs] = useState<GeneratedOutput[] | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const copy = translations[interfaceLanguage];
  const toggleCopy = copy.toggles;

  useEffect(() => {
    ensureGlobalStyles();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const applyTheme = (mode: ThemeMode) => {
      root.setAttribute('data-theme', mode);
    };
    let media: MediaQueryList | null = null;
    const mediaListener = (event: MediaQueryListEvent) => {
      applyTheme(event.matches ? 'dark' : 'light');
    };

    if (themeMode === 'system') {
      media = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(media.matches ? 'dark' : 'light');
      if (media.addEventListener) {
        media.addEventListener('change', mediaListener);
      } else {
        media.addListener(mediaListener);
      }
    } else {
      applyTheme(themeMode);
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('anclora.theme', themeMode);
    }

    return () => {
      if (media) {
        if (media.removeEventListener) {
          media.removeEventListener('change', mediaListener);
        } else {
          media.removeListener(mediaListener);
        }
      }
    };
  }, [themeMode]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = interfaceLanguage;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('anclora.lang', interfaceLanguage);
    }
  }, [interfaceLanguage]);

  const generateContentApiCall = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setError(null);
    setGeneratedOutputs(null);
    setGeneratedImageUrl(null);
    try {
      const enforcedPrompt = `${prompt}
Recuerda responder unicamente con JSON y seguir este ejemplo: ${structuredOutputExample}`;
      const raw = await callTextModel(enforcedPrompt);
      const jsonString = extractJsonPayload(raw);
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.outputs)) {
        setGeneratedOutputs(parsed.outputs);
      } else {
        setError('El modelo no devolvio el formato esperado.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const handleHelp = () => {
    setIsHelpOpen(true);
  };
  const closeHelp = () => {
    setIsHelpOpen(false);
  };

  const commonProps: CommonProps = {
    isLoading,
    error,
    generatedOutputs,
    generatedImageUrl,
    onGenerate: generateContentApiCall,
    onCopy: copyToClipboard,
    setError,
    setIsLoading,
    setGeneratedImageUrl,
    interfaceLanguage,
  };

  const tabsOrder: { id: string; label: string }[] = [
    { id: 'basic', label: copy.tabs.basic },
    { id: 'intelligent', label: copy.tabs.intelligent },
    { id: 'campaign', label: copy.tabs.campaign },
    { id: 'recycle', label: copy.tabs.recycle },
    { id: 'chat', label: copy.tabs.chat },
    { id: 'tts', label: copy.tabs.tts },
    { id: 'live', label: copy.tabs.live },
    { id: 'image', label: copy.tabs.image },
  ];
  const themeLabels: Record<ThemeMode, string> = {
    light: toggleCopy.themeLight,
    dark: toggleCopy.themeDark,
    system: toggleCopy.themeSystem,
  };
  const languageLabels: Record<InterfaceLanguage, string> = {
    es: toggleCopy.langEs,
    en: toggleCopy.langEn,
  };
  const helpLabel = interfaceLanguage === 'es' ? 'Abrir ayuda rapida' : 'Open quick tips';
  const helpCloseLabel = interfaceLanguage === 'es' ? 'Cerrar ayuda' : 'Close help';

  return (
    <div style={commonStyles.container}>
      <header style={commonStyles.header}>
        <div style={commonStyles.headerTop}>
          <h1 style={commonStyles.title}>{copy.title}</h1>
          <p style={commonStyles.subtitle}>{copy.subtitle}</p>
        </div>
        <div style={commonStyles.headerControls}>
          <div style={commonStyles.toggleGroup}>
            {(['light', 'dark', 'system'] as ThemeMode[]).map(mode => (
              <button
                type="button"
                key={mode}
                style={{ ...commonStyles.toggleButton, ...(themeMode === mode ? commonStyles.toggleButtonActive : {}) }}
                onClick={() => setThemeMode(mode)}
                aria-pressed={themeMode === mode}
                aria-label={themeLabels[mode]}
                title={themeLabels[mode]}
              >
                {renderThemeIcon(mode)}
              </button>
            ))}
          </div>
          <div style={commonStyles.toggleGroup}>
            {(['es', 'en'] as InterfaceLanguage[]).map(lang => (
              <button
                type="button"
                key={lang}
                style={{ ...commonStyles.toggleButton, ...(interfaceLanguage === lang ? commonStyles.toggleButtonActive : {}) }}
                onClick={() => setInterfaceLanguage(lang)}
                aria-pressed={interfaceLanguage === lang}
                aria-label={languageLabels[lang]}
                title={languageLabels[lang]}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          <button type="button" style={commonStyles.helpButton} onClick={handleHelp} aria-label={helpLabel} title={helpLabel}>?</button>
        </div>
      </header>

      <main style={commonStyles.mainContent}>
        <nav style={commonStyles.tabNavigation}>
          {tabsOrder.map(tab => (
            <button
              key={tab.id}
              style={{ ...commonStyles.tabButton, ...(activeTab === tab.id && commonStyles.tabButtonActive) }}
              onClick={() => {
                setActiveTab(tab.id);
                setGeneratedOutputs(null);
                setGeneratedImageUrl(null);
                setError(null);
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'basic' && <BasicMode {...commonProps} />}
        {activeTab === 'intelligent' && <IntelligentMode {...commonProps} />}
        {activeTab === 'campaign' && <CampaignMode {...commonProps} />}
        {activeTab === 'recycle' && <RecycleMode {...commonProps} />}
        {activeTab === 'chat' && <ChatMode interfaceLanguage={interfaceLanguage} onCopy={copyToClipboard} />}
        {activeTab === 'tts' && <TTSMode interfaceLanguage={interfaceLanguage} />}
        {activeTab === 'live' && <LiveChatMode interfaceLanguage={interfaceLanguage} />}
        {activeTab === 'image' && <ImageEditMode interfaceLanguage={interfaceLanguage} />}
      </main>
      {isHelpOpen && (
        <div style={commonStyles.helpOverlay} role="presentation" onClick={closeHelp}>
          <div
            style={commonStyles.helpModal}
            role="dialog"
            aria-modal="true"
            aria-label={copy.helpTitle}
            onClick={event => event.stopPropagation()}
          >
            <div style={commonStyles.helpModalHeader}>
              <h2 style={{ margin: 0 }}>{copy.helpTitle}</h2>
              <button type="button" style={commonStyles.helpCloseButton} onClick={closeHelp} aria-label={helpCloseLabel} title={helpCloseLabel}>×</button>
            </div>
            <p style={commonStyles.helpIntro}>{copy.help}</p>
            <ul style={commonStyles.helpModalList}>
              {copy.helpTips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
