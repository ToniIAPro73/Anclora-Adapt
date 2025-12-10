/**
 * src/utils/hardwareValidator.ts
 *
 * Valida si operaciones específicas son posibles según el hardware disponible.
 * Proporciona mensajes contextuales para guiar al usuario.
 */

import type { SystemCapabilities, AppMode } from "@/types";

export interface ValidationResult {
  isSupported: boolean;
  message: string;
  requiresHardwareAdjust: boolean;
}

/**
 * Valida si un modo específico es soportado por el hardware actual.
 * Si no hay hardwareProfile, asume que el usuario debería detectar hardware.
 */
export const validateModeSupport = (
  mode: AppMode,
  hardwareProfile?: SystemCapabilities
): ValidationResult => {
  // Si no hay perfil de hardware, no sabemos si es soportado
  if (!hardwareProfile) {
    return {
      isSupported: true, // Asumimos que sí por defecto
      message: "",
      requiresHardwareAdjust: false,
    };
  }

  // Buscar el modo en las recomendaciones
  const modeSupport = hardwareProfile.mode_support?.find(
    (m) => m.id === mode
  );

  if (!modeSupport) {
    // Modo no documentado, asumir que sí
    return {
      isSupported: true,
      message: "",
      requiresHardwareAdjust: false,
    };
  }

  if (modeSupport.enabled) {
    return {
      isSupported: true,
      message: "",
      requiresHardwareAdjust: false,
    };
  }

  // Modo no soportado
  const reason = modeSupport.reason || "Hardware insufficient";
  const ramGb = hardwareProfile.hardware.ram_gb;
  const vramGb = hardwareProfile.hardware.gpu_vram_gb;
  const hasGpu = hardwareProfile.hardware.has_cuda;

  let message = "";

  if (mode === "image") {
    message = `Image analysis requires 4GB VRAM (GPU) or 16GB RAM. Your system: ${vramGb}GB VRAM, ${ramGb}GB RAM. Click "Adjust Hardware" to enable image features if available.`;
  } else if (mode === "tts" || mode === "live") {
    message = `${mode === "tts" ? "Text-to-Speech" : "Live Chat"} requires at least 8GB RAM. Your system: ${ramGb}GB RAM. Click "Adjust Hardware" to see available features.`;
  } else {
    message = `This mode is not supported on your current hardware. ${reason}. Click "Adjust Hardware" for more details.`;
  }

  return {
    isSupported: false,
    message,
    requiresHardwareAdjust: true,
  };
};

/**
 * Valida si la generación de imágenes es posible con el hardware actual.
 */
export const validateImageGeneration = (
  hardwareProfile?: SystemCapabilities
): ValidationResult => {
  if (!hardwareProfile) {
    return {
      isSupported: true,
      message: "",
      requiresHardwareAdjust: false,
    };
  }

  const vramGb = hardwareProfile.hardware.gpu_vram_gb;
  const ramGb = hardwareProfile.hardware.ram_gb;

  // Image analysis necesita GPU con 4GB+ VRAM o CPU con 16GB+ RAM
  const hasEnoughGpu = hardwareProfile.hardware.has_cuda && vramGb >= 4;
  const hasEnoughRam = ramGb >= 16;

  if (hasEnoughGpu || hasEnoughRam) {
    return {
      isSupported: true,
      message: "",
      requiresHardwareAdjust: false,
    };
  }

  return {
    isSupported: false,
    message: `Image analysis requires GPU with 4GB+ VRAM or CPU with 16GB+ RAM. Your system: ${
      hardwareProfile.hardware.has_cuda ? `${vramGb}GB VRAM` : `${ramGb}GB RAM (no GPU)`
    }. Click "Adjust Hardware" to verify your specifications.`,
    requiresHardwareAdjust: true,
  };
};

/**
 * Valida si TTS (Text-to-Speech) es soportado.
 */
export const validateTTS = (
  hardwareProfile?: SystemCapabilities
): ValidationResult => {
  if (!hardwareProfile) {
    return {
      isSupported: true,
      message: "",
      requiresHardwareAdjust: false,
    };
  }

  const ramGb = hardwareProfile.hardware.ram_gb;

  if (ramGb >= 8) {
    return {
      isSupported: true,
      message: "",
      requiresHardwareAdjust: false,
    };
  }

  return {
    isSupported: false,
    message: `Text-to-Speech requires at least 8GB RAM. Your system has ${ramGb}GB RAM. Click "Adjust Hardware" for more options.`,
    requiresHardwareAdjust: true,
  };
};

/**
 * Valida si una operación general es posible.
 * Retorna avisos útiles para el usuario.
 */
export const validateOperation = (
  operation: "text-generation" | "image-generation" | "tts" | "stt",
  hardwareProfile?: SystemCapabilities
): ValidationResult => {
  switch (operation) {
    case "image-generation":
      return validateImageGeneration(hardwareProfile);
    case "tts":
      return validateTTS(hardwareProfile);
    case "text-generation":
    case "stt":
    default:
      // Text generation y STT son soportados en casi cualquier hardware
      return {
        isSupported: true,
        message: "",
        requiresHardwareAdjust: false,
      };
  }
};

/**
 * Genera un aviso informativo si el usuario debería ajustar hardware.
 * Se muestra si hardware no ha sido detectado automáticamente.
 */
export const getHardwareAdjustmentPrompt = (
  hardwareProfile?: SystemCapabilities
): string | null => {
  if (hardwareProfile) {
    // Hardware ya fue detectado
    return null;
  }

  return "💡 Click 'Adjust Hardware' to detect your system capabilities and unlock all features available for your device.";
};
