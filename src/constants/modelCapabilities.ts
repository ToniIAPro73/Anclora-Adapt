import { AUTO_TEXT_MODEL_ID } from "@/types";
import { languages } from "@/constants/options";

const BASE_LANGUAGES = ["es", "en", "fr", "de", "pt", "it"];
const EXTENDED_LANGUAGES = [...BASE_LANGUAGES, "ru"];
const CJK_LANGUAGES = [...EXTENDED_LANGUAGES, "ja", "zh"];

type CapabilityEntry = {
  keywords: string[];
  languages: string[];
};

const capabilityMatrix: CapabilityEntry[] = [
  {
    keywords: [
      "llama2",
      "llama3",
      "llama3.2",
      "mixtral",
      "mistral",
      "gemma3",
      "orca",
      "phi",
    ],
    languages: EXTENDED_LANGUAGES,
  },
  {
    keywords: ["qwen", "yi", "deepseek", "command"],
    languages: CJK_LANGUAGES,
  },
];

const languageHints: Record<string, string> = {
  ja: "Instala un modelo con soporte asiático (por ejemplo qwen2.5) para habilitar japonés.",
  zh: "Instala un modelo compatible con caracteres chinos (qwen2.5 o Yi funcionan muy bien).",
  ru: "Necesitas un modelo multilingüe (mistral o qwen) para generar en ruso.",
};

const normalizeModelId = (modelId: string) =>
  modelId?.split(":")[0].toLowerCase() ?? "";

export const inferLanguagesForModel = (modelId: string): string[] => {
  const normalized = normalizeModelId(modelId);
  const matched = capabilityMatrix.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );
  return matched ? matched.languages : BASE_LANGUAGES;
};

const union = (sets: string[][]): string[] => {
  const merged = new Set<string>();
  sets.forEach((arr) => arr.forEach((lang) => merged.add(lang)));
  return Array.from(merged);
};

const ensureModelList = (
  installedModels: string[],
  selected: string
): string[] => {
  const normalized = installedModels?.length ? [...installedModels] : [];
  if (!normalized.length) {
    normalized.push(selected);
  }
  if (!normalized.includes(selected)) {
    normalized.push(selected);
  }
  return normalized;
};

export interface LanguageOptionAvailability {
  value: string;
  label: string;
  disabled?: boolean;
  reason?: string;
}

export const buildLanguageOptions = (
  selectedModelId: string,
  installedModels: string[]
): LanguageOptionAvailability[] => {
  const models = ensureModelList(installedModels, selectedModelId);
  const effectiveModels = models.filter(
    (model) => model && model !== AUTO_TEXT_MODEL_ID
  );
  const sourceModels =
    effectiveModels.length > 0 ? effectiveModels : [selectedModelId];

  const supportedLanguages =
    selectedModelId === AUTO_TEXT_MODEL_ID
      ? union(sourceModels.map(inferLanguagesForModel))
      : inferLanguagesForModel(selectedModelId);

  const supportedSet = new Set<string>([
    ...supportedLanguages,
    "detect",
  ]);

  return languages.map((option) => {
    const disabled = !supportedSet.has(option.value);
    return {
      ...option,
      disabled,
      reason: disabled ? languageHints[option.value] : undefined,
    };
  });
};
