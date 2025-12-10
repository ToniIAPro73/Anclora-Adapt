const STORAGE_KEY = "anclora-model-decisions";

export type ModelDecisionMap = Record<string, string>;

const safeParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const loadModelDecisions = (): ModelDecisionMap => {
  if (typeof window === "undefined") return {};
  return safeParse<ModelDecisionMap>(localStorage.getItem(STORAGE_KEY), {});
};

export const saveModelDecision = (mode: string, modelId: string) => {
  if (typeof window === "undefined") return;
  const map = loadModelDecisions();
  map[mode] = modelId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};
