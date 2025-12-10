import type { AutoModelContext, SystemCapabilities } from "@/types";

export type ContextAdjustmentResult = {
  context: AutoModelContext | undefined;
  notices: string[];
};

let runtimeHardware: SystemCapabilities | null = null;

export const setRuntimeHardwareProfile = (profile: SystemCapabilities | null) => {
  runtimeHardware = profile;
};

export const getRuntimeHardwareProfile = () => runtimeHardware;

const getTextCharacterCeiling = () => {
  const ramGb = runtimeHardware?.hardware?.ram_gb ?? 0;
  if (ramGb >= 32) return 4000;
  if (ramGb >= 24) return 2800;
  if (ramGb >= 16) return 2000;
  if (ramGb >= 12) return 1400;
  return 900;
};

export const adaptContextForHardware = (
  context?: AutoModelContext,
  profile?: SystemCapabilities | null
): ContextAdjustmentResult => {
  runtimeHardware = profile ?? runtimeHardware;
  if (!context) {
    return { context, notices: [] };
  }
  const cloned: AutoModelContext = { ...context };
  const notices: string[] = [];
  const textLimit = getTextCharacterCeiling();

  if (typeof cloned.maxChars === "number" && cloned.maxChars > textLimit) {
    notices.push(
      `Max chars limited to ${textLimit} due to available RAM (${profile?.hardware?.ram_gb ?? "?"}GB).`
    );
    cloned.maxChars = textLimit;
  }

  if (
    typeof cloned.minChars === "number" &&
    typeof cloned.maxChars === "number" &&
    cloned.minChars > cloned.maxChars
  ) {
    cloned.minChars = cloned.maxChars;
  }

  if (typeof cloned.minChars === "number" && cloned.minChars > textLimit) {
    cloned.minChars = Math.min(textLimit, cloned.minChars);
    notices.push(
      `Min chars adjusted to ${cloned.minChars} to avoid memory pressure.`
    );
  }

  return { context: cloned, notices };
};

export const getImageDimensionLimit = () => {
  const hasCuda = runtimeHardware?.hardware?.has_cuda ?? false;
  const vram = runtimeHardware?.hardware?.gpu_vram_gb ?? 0;

  if (!hasCuda || vram < 4) {
    return { width: 768, height: 768 };
  }

  if (vram < 6) {
    return { width: 896, height: 896 };
  }

  if (vram < 8) {
    return { width: 1024, height: 1024 };
  }

  return { width: 1280, height: 1280 };
};
