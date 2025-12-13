import type { AutoModelContext, GeneratedOutput } from "@/types";

const CORE_PLATFORMS = ["linkedin", "x", "twitter", "instagram", "whatsapp", "email"];

const normalize = (value?: string) =>
  (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const validateOutputsAgainstRequest = (
  outputs: GeneratedOutput[],
  context?: AutoModelContext
) => {
  if (!context?.allowedPlatforms || context.allowedPlatforms.length === 0) {
    return;
  }

  const normalizedOutputs = outputs.map((output) => normalize(output.platform));
  const requested = context.allowedPlatforms.map((platform) => normalize(platform));

  const relevantRequested = requested.filter((platform) =>
    CORE_PLATFORMS.includes(platform)
  );

  const missing = relevantRequested.filter(
    (platform) =>
      !normalizedOutputs.some((value) =>
        value === platform ||
        value.startsWith(platform) ||
        value.includes(platform === "x" ? "twitter" : platform)
      )
  );

  if (missing.length) {
    throw new Error(
      `El modelo no devolvió contenido para: ${missing
        .map((platform) => platform.toUpperCase())
        .join(", ")}.`
    );
  }

  if (context.isLiteralTranslation && outputs.length !== 1) {
    throw new Error(
      "La traducción literal debe generar exactamente una salida; ajusta las plataformas seleccionadas."
    );
  }

  outputs.forEach((output) => {
    const normalizedPlatform = normalize(output.platform);
    if (normalizedPlatform.startsWith("instagram")) {
      const trimmedContent = output.content.trim();
      if (
        !trimmedContent ||
        /legenda\s*:\s*$/i.test(trimmedContent) ||
        /caption\s*:\s*$/i.test(trimmedContent)
      ) {
        throw new Error(
          "El contenido para Instagram debe incluir un caption completo; no dejes la sección de Leyenda vacía."
        );
      }
    }
  });
};
