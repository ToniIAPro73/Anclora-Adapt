/**
 * src/hooks/useTTS.ts
 *
 * Hook para Text-to-Speech usando Kokoro-82M desde backend FastAPI
 * Maneja generación, reproducción, descarga y cancelación
 *
 * ⚠️ CRÍTICO: Este hook REEMPLAZA la antigua integración con pyttsx3
 * Ahora usa el backend Python FastAPI en http://localhost:8000/api/tts
 *
 * FASE 1.3 - Custom Hooks
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { apiService } from "@/services/api";
import { AudioPlayer, downloadAudio } from "@/services/audio";

interface UseTTSOptions {
  /**
   * Idioma por defecto (ej: "es", "en", "fr")
   */
  defaultLanguage?: string;

  /**
   * Preset de voz por defecto (ej: "af_sarah")
   */
  defaultVoice?: string;

  /**
   * Callback cuando se completa la generación
   */
  onSuccess?: (audioBlob: Blob) => void;

  /**
   * Callback cuando ocurre un error
   */
  onError?: (error: Error) => void;

  /**
   * Callback cuando termina la reproducción
   */
  onPlayEnd?: () => void;
}

interface UseTTSReturn {
  /**
   * Genera audio a partir de texto
   */
  generateTTS: (
    text: string,
    language?: string,
    voicePreset?: string
  ) => Promise<Blob>;

  /**
   * Reproduce el audio generado
   */
  play: () => Promise<void>;

  /**
   * Pausa la reproducción actual
   */
  pause: () => void;

  /**
   * Detiene la reproducción
   */
  stop: () => void;

  /**
   * Descarga el audio actual
   */
  download: (filename?: string) => void;

  /**
   * Cancela la generación en progreso
   */
  cancel: () => void;

  // ==========================================
  // STATE
  // ==========================================

  /**
   * Audio blob generado
   */
  audioBlob: Blob | null;

  /**
   * Error si ocurrió durante la generación
   */
  error: Error | null;

  /**
   * True si hay una generación TTS en progreso
   */
  isGenerating: boolean;

  /**
   * True si el audio está siendo reproducido
   */
  isPlaying: boolean;

  /**
   * Tiempo actual de reproducción en segundos
   */
  currentTime: number;

  /**
   * Duración total del audio en segundos
   */
  duration: number;
}

/**
 * Hook para Text-to-Speech con Kokoro-82M
 *
 * CAMBIO CRÍTICO desde pyttsx3:
 * - Antes: Endpoint local en http://localhost:9000/tts (pyttsx3 con SAPI5)
 * - Ahora: Backend FastAPI en http://localhost:8000/api/tts (Kokoro-82M)
 *
 * Ejemplo de uso:
 * ```typescript
 * const { generateTTS, play, pause, download, isGenerating, isPlaying } = useTTS({
 *   defaultLanguage: 'es',
 *   defaultVoice: 'af_sarah'
 * })
 *
 * const handleSpeak = async () => {
 *   try {
 *     await generateTTS("Hola mundo", "es", "af_sarah")
 *     await play()
 *   } catch (err) {
 *     console.error("Error TTS:", err)
 *   }
 * }
 *
 * return (
 *   <>
 *     <button onClick={handleSpeak} disabled={isGenerating}>
 *       {isGenerating ? "Generando..." : "Hablar"}
 *     </button>
 *     <button onClick={play} disabled={!audioBlob || isPlaying}>
 *       {isPlaying ? "Reproduciendo..." : "Reproducir"}
 *     </button>
 *     <button onClick={pause} disabled={!isPlaying}>
 *       Pausar
 *     </button>
 *     <button onClick={() => download("audio.wav")} disabled={!audioBlob}>
 *       Descargar
 *     </button>
 *     {error && <div style={{color: 'red'}}>{error.message}</div>}
 *   </>
 * )
 * ```
 */
export const useTTS = (options: UseTTSOptions = {}): UseTTSReturn => {
  const {
    defaultLanguage = "es",
    defaultVoice = "af_sarah",
    onSuccess,
    onError,
    onPlayEnd,
  } = options;

  // State
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Refs
  const playerRef = useRef<AudioPlayer | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inicializar reproductor
  if (!playerRef.current) {
    playerRef.current = new AudioPlayer();
  }

  // Generar TTS
  const generateTTS = useCallback(
    async (
      text: string,
      language: string = defaultLanguage,
      voicePreset: string = defaultVoice
    ): Promise<Blob> => {
      if (!text || text.trim().length === 0) {
        const err = new Error("El texto para TTS no puede estar vacío");
        setError(err);
        onError?.(err);
        throw err;
      }

      try {
        abortControllerRef.current = new AbortController();

        setIsGenerating(true);
        setError(null);
        setAudioBlob(null);

        console.log(
          `🎤 TTS: Generando "${text.substring(0, 30)}..." (${language}, voz: ${voicePreset})`
        );

        const blob = await apiService.generateTTS(text, language, voicePreset);

        if (abortControllerRef.current.signal.aborted) {
          throw new Error("Generación TTS cancelada");
        }

        setAudioBlob(blob);
        console.log(`✓ TTS: Audio generado (${blob.size} bytes)`);
        onSuccess?.(blob);
        return blob;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (!abortControllerRef.current?.signal.aborted) {
          setError(error);
          onError?.(error);
          console.error("❌ Error TTS:", error.message);
        }

        throw error;
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [defaultLanguage, defaultVoice, onSuccess, onError]
  );

  // Reproducir
  const play = useCallback(async () => {
    if (!audioBlob) {
      const err = new Error(
        "No hay audio para reproducir. Primero genera TTS con generateTTS()"
      );
      setError(err);
      throw err;
    }

    try {
      setIsPlaying(true);

      await playerRef.current?.play(audioBlob, () => {
        setIsPlaying(false);
        onPlayEnd?.();
      });

      // Actualizar tiempo actual cada 100ms
      updateIntervalRef.current = setInterval(() => {
        if (playerRef.current) {
          setCurrentTime(playerRef.current.getCurrentTime());
          setDuration(playerRef.current.getDuration());
        }
      }, 100);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsPlaying(false);
      onError?.(error);
      throw error;
    }
  }, [audioBlob, onPlayEnd, onError]);

  // Pausar
  const pause = useCallback(() => {
    playerRef.current?.pause();
    setIsPlaying(false);
  }, []);

  // Detener
  const stop = useCallback(() => {
    playerRef.current?.stop();
    setIsPlaying(false);
    setCurrentTime(0);

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  // Descargar
  const download = useCallback((filename?: string) => {
    if (!audioBlob) {
      const err = new Error("No hay audio para descargar");
      setError(err);
      throw err;
    }

    try {
      downloadAudio(
        audioBlob,
        filename || `audio-${Date.now()}.wav`
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    }
  }, [audioBlob]);

  // Cancelar
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    stop();
  }, [stop]);

  // Cleanup
  const cleanup = useCallback(() => {
    stop();
    playerRef.current?.dispose();

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }
  }, [stop]);

  // Cleanup en desmontaje
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    generateTTS,
    play,
    pause,
    stop,
    download,
    cancel,
    audioBlob,
    error,
    isGenerating,
    isPlaying,
    currentTime,
    duration,
  };
};
