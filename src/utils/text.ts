import type { InterfaceLanguage } from "../types";

export const formatCounterText = (
  value: string,
  language: InterfaceLanguage
) => {
  const chars = value.length;
  const tokens = chars === 0 ? 0 : Math.max(1, Math.round(chars / 4));
  const charLabel = language === "es" ? "caracteres" : "characters";
  const tokenLabel =
    language === "es" ? "tokens estimados" : "estimated tokens";
  return `${chars} ${charLabel} ~ ${tokens} ${tokenLabel}`;
};
