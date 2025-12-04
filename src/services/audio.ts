/**
 * src/services/audio.ts
 *
 * Utilidades para manejo de audio (grabación, reproducción, conversión)
 * Helpers para integración con hooks useTTS() y useSTT()
 *
 * FASE 1.2 - Refactorización de Servicios
 */

// ==========================================
// AUDIO RECORDING UTILITIES
// ==========================================

/**
 * Clase para grabar audio desde el micrófono del usuario
 * Usa Web Audio API (MediaRecorder)
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  /**
   * Inicia la grabación de audio
   * Pide permiso al usuario si es necesario
   */
  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.start();
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          throw new Error(
            "Permiso denegado para acceder al micrófono. Verifica configuración del navegador."
          );
        } else if (error.name === "NotFoundError") {
          throw new Error(
            "No se encontró micrófono en tu dispositivo. Verifica tu hardware."
          );
        }
      }
      throw new Error(`Error al acceder al micrófono: ${error}`);
    }
  }

  /**
   * Detiene la grabación y retorna el audio como Blob
   */
  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No hay grabación en progreso"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
        this.audioChunks = [];
        resolve(audioBlob);
      };

      this.mediaRecorder.onerror = (event) => {
        reject(new Error(`Error durante grabación: ${event.error}`));
      };

      this.mediaRecorder.stop();

      // Detener el stream para liberar el micrófono
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
      }
    });
  }

  /**
   * Cancela la grabación sin guardar
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }

    this.audioChunks = [];
    this.mediaRecorder = null;
    this.stream = null;
  }

  /**
   * Retorna true si está grabando en este momento
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording" ?? false;
  }
}

// ==========================================
// AUDIO PLAYBACK UTILITIES
// ==========================================

/**
 * Clase para reproducir audio desde un Blob
 */
export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;

  /**
   * Reproduce un Blob de audio
   * @param audioBlob - Blob con datos de audio (WAV, MP3, etc.)
   * @param onEnded - Callback opcional cuando termina la reproducción
   */
  async play(audioBlob: Blob, onEnded?: () => void): Promise<void> {
    // Crear un objeto URL para el blob
    const audioUrl = URL.createObjectURL(audioBlob);

    // Si ya hay una reproducción, detenerla primero
    if (this.audio) {
      this.audio.pause();
    }

    // Crear nuevo elemento de audio
    this.audio = new Audio(audioUrl);

    if (onEnded) {
      this.audio.onended = onEnded;
    }

    try {
      await this.audio.play();
    } catch (error) {
      URL.revokeObjectURL(audioUrl);
      throw new Error(`Error al reproducir audio: ${error}`);
    }
  }

  /**
   * Pausa la reproducción actual
   */
  pause(): void {
    if (this.audio) {
      this.audio.pause();
    }
  }

  /**
   * Detiene la reproducción y libera recursos
   */
  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  /**
   * Retorna true si está reproduciendo
   */
  isPlaying(): boolean {
    return this.audio?.paused === false;
  }

  /**
   * Obtiene el tiempo actual en segundos
   */
  getCurrentTime(): number {
    return this.audio?.currentTime ?? 0;
  }

  /**
   * Obtiene la duración total en segundos
   */
  getDuration(): number {
    return this.audio?.duration ?? 0;
  }

  /**
   * Limpia recursos del reproductor
   */
  dispose(): void {
    if (this.audio) {
      this.audio.pause();
      if (this.audio.src) {
        URL.revokeObjectURL(this.audio.src);
      }
    }
    this.audio = null;
  }
}

// ==========================================
// AUDIO CONVERSION UTILITIES
// ==========================================

/**
 * Convierte un Blob de audio a base64
 * Útil para enviar por API si es necesario
 */
export const audioToBase64 = (audioBlob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const commaIndex = result.indexOf(",");
        resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
      } else {
        reject(new Error("No se pudo convertir audio a base64"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Error al leer archivo de audio"));
    };
    reader.readAsDataURL(audioBlob);
  });
};

/**
 * Descarga un Blob de audio al dispositivo del usuario
 */
export const downloadAudio = (audioBlob: Blob, filename: string): void => {
  const url = URL.createObjectURL(audioBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "audio.wav";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ==========================================
// AUDIO FORMAT DETECTION
// ==========================================

/**
 * Detecta el tipo de audio de un Blob
 * Retorna el tipo MIME detectado
 */
export const detectAudioType = (blob: Blob): string => {
  if (blob.type) {
    return blob.type; // Si el blob ya tiene tipo, usarlo
  }

  // Detectar por estructura del archivo
  const reader = new Uint8Array(blob.slice(0, 4));

  // WAV: RIFF header
  if (
    reader[0] === 0x52 &&
    reader[1] === 0x49 &&
    reader[2] === 0x46 &&
    reader[3] === 0x46
  ) {
    return "audio/wav";
  }

  // MP3: ID3 header
  if (reader[0] === 0xff && (reader[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }

  // Fallback
  return "audio/wav";
};

// ==========================================
// VOICE PRESET TYPES & DEFAULTS
// ==========================================

export interface VoicePreset {
  id: string;
  name: string;
  language: string;
  gender?: "male" | "female" | "neutral";
}

/**
 * Presets de voces disponibles para Kokoro-82M
 * Estos se cargarán desde el backend en el futuro
 */
export const DEFAULT_VOICE_PRESETS: Record<string, VoicePreset> = {
  af_sarah: {
    id: "af_sarah",
    name: "Sarah (Female)",
    language: "en",
    gender: "female",
  },
  am_adam: {
    id: "am_adam",
    name: "Adam (Male)",
    language: "en",
    gender: "male",
  },
  bf_emma: {
    id: "bf_emma",
    name: "Emma (Female)",
    language: "en",
    gender: "female",
  },
  bm_george: {
    id: "bm_george",
    name: "George (Male)",
    language: "en",
    gender: "male",
  },
};

/**
 * Mapeo de códigos de idioma a nombres amigables
 */
export const LANGUAGE_CODES: Record<string, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  ru: "Русский",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
};

// ==========================================
// AUDIO VALIDATION
// ==========================================

/**
 * Valida que un Blob sea audio válido
 */
export const validateAudioBlob = (blob: Blob): boolean => {
  if (!blob || blob.size === 0) {
    return false;
  }

  const validTypes = ["audio/wav", "audio/mpeg", "audio/ogg", "audio/mp4"];
  return validTypes.includes(blob.type) || detectAudioType(blob) === "audio/wav";
};

/**
 * Calcula la duración de audio desde el tamaño del blob (aproximado)
 * Solo funciona para WAV con este cálculo simple
 */
export const estimateAudioDuration = (blob: Blob): number => {
  // Esto es muy aproximado. En WAV, sample rate típico es 44100 Hz
  // Cada muestra ocupa 2 bytes (16-bit)
  // Duración = (tamaño blob - header de 44 bytes) / (44100 * 2)
  const estimatedSampleRate = 44100;
  const bytesPerSample = 2;
  const headerSize = 44;

  const audioDataBytes = Math.max(0, blob.size - headerSize);
  const duration = audioDataBytes / (estimatedSampleRate * bytesPerSample);

  return Math.round(duration * 100) / 100; // Redondear a 2 decimales
};
