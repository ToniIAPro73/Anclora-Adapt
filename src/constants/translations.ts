import type { InterfaceLanguage } from "@/types";

export const translations: Record<InterfaceLanguage, {
    title: string;
    subtitle: string;
    help: string;
    helpTitle: string;
    helpTips: string[];
    tabs: {
      basic: string;
      intelligent: string;
      campaign: string;
      recycle: string;
      chat: string;
      tts: string;
      live: string;
      image: string;
    };
    toggles: {
      themeLight: string;
      themeDark: string;
      themeSystem: string;
      langEs: string;
      langEn: string;
    };
    modelSelector: {
      label: string;
      current: string;
      refresh: string;
      loading: string;
      error: string;
      reset: string;
      lastUsed?: string;
    };
    output: {
      loading: string;
      downloadAudio: string;
      downloadImage: string;
      copy: string;
      copied?: string;
    };
    basic: {
      ideaLabel: string;
      ideaPlaceholder: string;
      languageLabel: string;
      toneLabel: string;
      speedLabel: string;
      speedDetailed: string;
      speedFlash: string;
      platformLabel: string;
      literalLabel: string;
      maxCharsLabel?: string;
      uploadLabel?: string;
      uploadHint?: string;
      buttonIdle: string;
      buttonLiteral?: string;
      buttonLoading: string;
      outputs: string;
      emptyState: string;
      errors: { idea: string; platforms: string; upload?: string };
    };
    intelligent: {
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
    };
    campaign: {
      ideaLabel: string;
      ideaPlaceholder: string;
      contextLabel: string;
      contextPlaceholder: string;
      languageLabel: string;
      buttonIdle: string;
      buttonLoading: string;
      errors: { idea: string };
    };
    recycle: {
      originalLabel: string;
      originalPlaceholder: string;
      contextLabel: string;
      contextPlaceholder: string;
      formatLabel: string;
      languageLabel: string;
      toneLabel: string;
      buttonIdle: string;
      buttonLoading: string;
      errors: { original: string };
    };
    chat: {
      intro: string;
      placeholder: string;
      button: string;
      typing: string;
    };
    tts: {
      textLabel: string;
      textPlaceholder: string;
      languageLabel: string;
      voiceLabel: string;
      buttonIdle: string;
      buttonLoading: string;
      voicesLoading: string;
      noticeFallback: string;
      errors: { text: string; unavailable: string; voices: string };
    };
    live: {
      intro: string;
      buttonStart: string;
      buttonStop: string;
      transcriptLabel: string;
      errors: { microphone: string; sttUnavailable: string };
    };
    image: {
      promptLabel: string;
      promptPlaceholder: string;
      buttonIdle: string;
      buttonLoading: string;
      errors: { prompt: string };
    };
  }> = {
  es: {
    title: "AncloraAdapt",
    subtitle: "Adapta, planifica y recicla contenido con modelos open source.",
    help: "Explora cada modo, agrega contexto y prueba prompts cortos antes de compartirlos.",
    helpTitle: "Guia rapida",
    helpTips: [
      "Completa el contexto/destino en cada modo para resultados mas precisos.",
      "Activa el proxy local (npm run dev) para evitar errores CORS con Hugging Face.",
      "Recuerda que la interfaz arranca en español; cambia a ingles con el toggle de idioma.",
    ],
    tabs: {
      basic: "Básico",
      intelligent: "Inteligente",
      campaign: "Campaña",
      recycle: "Reciclar",
      chat: "Chat",
      tts: "Voz",
      live: "Live chat",
      image: "Imagen",
    },
    toggles: {
      themeLight: "Modo claro",
      themeDark: "Modo oscuro",
      themeSystem: "Seguir el modo del sistema",
      langEs: "Interfaz en español",
      langEn: "Interfaz en inglés",
    },
    modelSelector: {
      label: "Modelo de texto",
      current: "Modelo en uso",
      refresh: "Actualizar modelos",
      loading: "Actualizando...",
      error: "No se pudo listar los modelos",
      reset: "Reiniciar pantalla (mantiene el modo actual)",
      lastUsed: "Modelo usado",
      hardwareAdjust: "Ajuste hardware",
      hardwareAdjusting: "Detectando...",
      hardwareDetected: "Hardware detectado",
    },
    output: {
      loading: "La IA esta trabajando...",
      downloadAudio: "Descargar audio",
      downloadImage: "Descargar imagen",
      copy: "Copiar",
      copied: "Copiado",
    },
    basic: {
      ideaLabel: "Tu idea principal",
      ideaPlaceholder: "Quiero contar que...",
      languageLabel: "Idioma",
      toneLabel: "Tono",
      speedLabel: "Velocidad",
      speedDetailed: "Detallado",
      speedFlash: "Flash",
      platformLabel: "Plataformas",
      literalLabel: "Forzar traducción literal (sin tono ni plataformas)",
      maxCharsLabel: "Máximo de caracteres",
      uploadLabel: "Importar texto",
      uploadHint: "Acepta .txt, .md o .csv y rellena automáticamente el campo.",
      buttonIdle: "Generar contenido",
      buttonLiteral: "Generar traducción",
      buttonLoading: "Generando...",
      outputs: "Resultados",
      emptyState: "Aquí aparecerán los resultados generados",
      errors: {
        idea: "Describe tu idea principal.",
        platforms: "Selecciona al menos una plataforma.",
        upload: "Solo se permiten archivos de texto (.txt, .md, .csv).",
      },
    },
    intelligent: {
      ideaLabel: "Describe tu necesidad",
      ideaPlaceholder: "Necesito adaptar un anuncio...",
      contextLabel: "Contexto / Destino",
      contextPlaceholder: "Equipo de ventas, newsletter, etc.",
      languageLabel: "Idioma de salida",
      deepThinkingLabel: "Pensamiento profundo",
      includeImageLabel: "Incluir imagen generada",
      imagePromptLabel: "Prompt de imagen",
      imagePromptPlaceholder: "Una ilustracion minimalista...",
      buttonIdle: "Generar adaptaciones",
      buttonLoading: "Interpretando...",
      errors: {
        idea: "Describe lo que necesitas.",
        imagePrompt: "Escribe el prompt para la imagen.",
      },
    },
    campaign: {
      ideaLabel: "Idea central de la campaña",
      ideaPlaceholder: "Ej: Lanzamiento express de...",
      contextLabel: "Contexto / Destino",
      contextPlaceholder: "Canales disponibles, presupuesto, etc.",
      languageLabel: "Idioma de salida",
      buttonIdle: "Generar campaña",
      buttonLoading: "Construyendo campaña...",
      errors: {
        idea: "Describe la idea base de tu campaña.",
      },
    },
    recycle: {
      originalLabel: "Contenido original",
      originalPlaceholder: "Pega el texto que quieres reciclar...",
      contextLabel: "Contexto / Destino",
      contextPlaceholder: "Donde se publicara, objetivo, etc.",
      formatLabel: "Formato deseado",
      languageLabel: "Idioma",
      toneLabel: "Tono",
      buttonIdle: "Reciclar contenido",
      buttonLoading: "Reciclando...",
      errors: {
        original: "Pega el contenido original.",
      },
    },
    chat: {
      intro: "Conversa con AncloraAI para resolver dudas rapidas.",
      placeholder: "Escribe tu mensaje...",
      button: "Enviar",
      typing: "Pensando...",
    },
    tts: {
      textLabel: "Texto a convertir a voz",
      textPlaceholder: "Hola, hoy lanzamos...",
      languageLabel: "Idioma de la voz",
      voiceLabel: "Selecciona la voz",
      buttonIdle: "Generar voz",
      buttonLoading: "Generando audio...",
      voicesLoading: "Cargando voces...",
      noticeFallback:
        "Reproducción con la voz del navegador (sin archivo descargable).",
      errors: {
        text: "Escribe el texto a convertir.",
        unavailable:
          "Configura VITE_TTS_ENDPOINT o usa un navegador con voz (speechSynthesis).",
        voices: "No se pudieron cargar las voces del servidor.",
      },
    },
    live: {
      intro: "Graba un fragmento corto y obten respuesta inmediata.",
      buttonStart: "Hablar",
      buttonStop: "Detener",
      transcriptLabel: "Transcripción",
      errors: {
        microphone: "No se pudo acceder al micrófono.",
        sttUnavailable:
          "Live Chat necesita VITE_STT_ENDPOINT. Configura el endpoint o usa Chat mientras tanto.",
        noSpeech: "No se detectó audio en la grabación.",
      },
    },
    image: {
      promptLabel: "Prompt de imagen",
      promptPlaceholder: "Describe la escena que necesitas...",
      buttonIdle: "Generar/Editar",
      buttonLoading: "Procesando...",
      errors: {
        prompt: "Escribe un prompt o sube una imagen.",
      },
    },
  },
  en: {
    title: "AncloraAdapt",
    subtitle: "Adapt, plan and recycle content with open-source models.",
    help: "Explore each mode, add context and test short prompts before sharing.",
    helpTitle: "Quick tips",
    helpTips: [
      "Fill the context/destination field to steer the generations.",
      "Use the local proxy (npm run dev) to avoid Hugging Face CORS issues.",
      "The UI defaults to Spanish; switch to English with the language toggle anytime.",
    ],
    tabs: {
      basic: "Basic",
      intelligent: "Intelligent",
      campaign: "Campaign",
      recycle: "Repurpose",
      chat: "Chat",
      tts: "Voice",
      live: "Live chat",
      image: "Image",
    },
    toggles: {
      themeLight: "Light mode",
      themeDark: "Dark mode",
      themeSystem: "Match system theme",
      langEs: "Interface in Spanish",
      langEn: "Interface in English",
    },
    modelSelector: {
      label: "Text model",
      current: "Current model",
      refresh: "Refresh models",
      loading: "Refreshing...",
      error: "Could not list the models",
      reset: "Reset screen (keeps current mode)",
      lastUsed: "Model used",
      hardwareAdjust: "Hardware fit",
      hardwareAdjusting: "Detecting...",
      hardwareDetected: "Detected hardware",
    },
    output: {
      loading: "The AI is crafting your content...",
      downloadAudio: "Download audio",
      downloadImage: "Download image",
      copy: "Copy",
      copied: "Copied",
    },
    basic: {
      ideaLabel: "Your main idea",
      ideaPlaceholder: "I want to announce...",
      languageLabel: "Output language",
      toneLabel: "Tone",
      speedLabel: "Detail level",
      speedDetailed: "Detailed",
      speedFlash: "Flash",
      platformLabel: "Platforms",
      literalLabel: "Literal translation only (disable tone/platforms)",
      maxCharsLabel: "Maximum characters",
      uploadLabel: "Import text",
      uploadHint: "Upload .txt or .md to auto-fill the field.",
      buttonIdle: "Generate content",
      buttonLoading: "Generating...",
      outputs: "Results",
      emptyState: "Generated results will appear here",
      errors: {
        idea: "Describe your main idea.",
        platforms: "Select at least one platform.",
        upload: "Only text files are allowed (.txt, .md, .csv).",
      },
    },
    intelligent: {
      ideaLabel: "Describe your need",
      ideaPlaceholder: "I need to adapt an offer...",
      contextLabel: "Context / Destination",
      contextPlaceholder: "Sales team, newsletter, etc.",
      languageLabel: "Output language",
      deepThinkingLabel: "Deep thinking",
      includeImageLabel: "Include generated image",
      imagePromptLabel: "Image prompt",
      imagePromptPlaceholder: "A minimalist illustration...",
      buttonIdle: "Generate adaptations",
      buttonLoading: "Interpreting...",
      errors: {
        idea: "Describe what you need.",
        imagePrompt: "Provide the image prompt.",
      },
    },
    campaign: {
      ideaLabel: "Campaign idea",
      ideaPlaceholder: "Ex: Express launch for...",
      contextLabel: "Context / Destination",
      contextPlaceholder: "Available channels, budget, etc.",
      languageLabel: "Output language",
      buttonIdle: "Generate campaign",
      buttonLoading: "Building campaign...",
      errors: {
        idea: "Describe the core idea for the campaign.",
      },
    },
    recycle: {
      originalLabel: "Original content",
      originalPlaceholder: "Paste the text you want to repurpose...",
      contextLabel: "Context / Destination",
      contextPlaceholder: "Where will it be published?",
      formatLabel: "Desired format",
      languageLabel: "Language",
      toneLabel: "Tone",
      buttonIdle: "Repurpose content",
      buttonLoading: "Repurposing...",
      errors: {
        original: "Paste the original content.",
      },
    },
    chat: {
      intro: "Chat with AncloraAI for quick guidance.",
      placeholder: "Type your message...",
      button: "Send",
      typing: "Typing...",
    },
    tts: {
      textLabel: "Text to convert",
      textPlaceholder: "Hello, today we launch...",
      languageLabel: "Voice language",
      voiceLabel: "Voice",
      buttonIdle: "Generate voice",
      buttonLoading: "Generating audio...",
      voicesLoading: "Loading voices...",
      noticeFallback:
        "Played with the browser voice (no downloadable file available).",
      errors: {
        text: "Provide the text to convert.",
        unavailable:
          "Set VITE_TTS_ENDPOINT or use a browser that supports speechSynthesis.",
        voices: "Could not load the voices from the server.",
      },
    },
    live: {
      intro: "Record a short snippet and get an instant reply.",
      buttonStart: "Start talking",
      buttonStop: "Stop",
      transcriptLabel: "Transcript",
      errors: {
        microphone: "Unable to access microphone.",
        sttUnavailable:
          "Live Chat needs VITE_STT_ENDPOINT. Configure it or use Chat mode meanwhile.",
        noSpeech: "No speech detected in the recording.",
      },
    },
    image: {
      promptLabel: "Image prompt",
      promptPlaceholder: "Describe the scene you need...",
      buttonIdle: "Generate/Edit",
      buttonLoading: "Processing...",
      errors: {
        prompt: "Write a prompt or upload an image.",
      },
    },
  },
};
