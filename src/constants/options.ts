export const languages = [
  { value: "detect", label: "Detectar automático" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "fr", label: "Francés" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Portugués" },
  { value: "it", label: "Italiano" },
  { value: "zh", label: "Chino" },
  { value: "ja", label: "Japonés" },
  { value: "ru", label: "Ruso" },
];

export const tones = [
  { value: "detect", label: "Detectar automático" },
  { value: "Profesional", label: "Profesional" },
  { value: "Amistoso", label: "Amistoso" },
  { value: "Formal", label: "Formal" },
  { value: "Casual", label: "Casual" },
  { value: "Motivador", label: "Motivador" },
  { value: "Emocional", label: "Emocional" },
  { value: "Directo", label: "Directo" },
  { value: "Creativo", label: "Creativo" },
];

export const recycleOptions = [
  { value: "summary", label: "Resumen conciso" },
  { value: "x_thread", label: "Hilo para X" },
  { value: "instagram_caption", label: "Caption para Instagram" },
  { value: "title_hook", label: "Título y gancho" },
  { value: "key_points", label: "Lista de puntos clave" },
  { value: "email_launch", label: "Email de lanzamiento" },
  { value: "press_release", label: "Nota de prensa" },
];

export const LANGUAGE_LABELS: Record<string, string> = {
  es: "Español",
  en: "English",
  fr: "Francés",
  de: "Deutsch",
  pt: "Portugués",
  it: "Italiano",
  zh: "中文",
  ja: "日本語",
  ru: "Русский",
  ar: "العربية",
};

export const LANGUAGE_CODE_MAP: Record<string, string[]> = {
  es: ["es-ES", "es"],
  en: ["en-US", "en"],
  fr: ["fr-FR", "fr"],
  de: ["de-DE", "de"],
  pt: ["pt-BR", "pt-PT", "pt"],
  it: ["it-IT", "it"],
  zh: ["zh-CN", "zh"],
  ja: ["ja-JP", "ja"],
  ru: ["ru-RU", "ru"],
  ar: ["ar-SA", "ar"],
};
