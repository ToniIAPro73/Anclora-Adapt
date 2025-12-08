/**
 * src/hooks/useSTT.ts
 *
 * Hook para Speech-to-Text usando Faster-Whisper desde backend FastAPI
 * Maneja grabación, transcripción y cancelación
 *
 * ⚠️ CRÍTICO: Este hook es NUEVO y NO EXISTÍA ANTES
 * Usa el backend Python FastAPI en http://localhost:8000/api/stt
 * Habilita el "Modo Live Chat" que antes no funcionaba
 *
 * FASE 1.3 - Custom Hooks
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { apiService } from "@/services/api";
import { AudioRecorder } from "@/services/audio";
import type { STTResponse } from "@/types";

interface UseSTTOptions {
  /**
   * Callback cuando se completa la transcripción
   */
  onSuccess?: (response: STTResponse) => void;

  /**
   * Callback cuando ocurre un error
   */
  onError?: (error: Error) => void;

  /**
   * Callback cuando termina la grabación
   */
  onRecordingEnd?: () => void;
}

interface UseSTTReturn {
  /**
   * Inicia la grabación de audio
   */
  startRecording: () => Promise<void>;

  /**
   * Detiene la grabación y transcribe el audio
   */
  stopRecording: () => Promise<STTResponse>;

  /**
   * Cancela la grabación sin transcribir
   */
  cancelRecording: () => void;

  /**
   * Transcribe un Blob de audio directamente
   */
  transcribe: (audioBlob: Blob) => Promise<STTResponse>;

  /**
   * Cancela la transcripción en progreso
   */
  cancel: () => void;

  // ==========================================
  // STATE
  // ==========================================

  /**
   * Texto transcrito
   */
  text: string;

  /**
   * Idioma detectado
   */
  detectedLanguage: string;

  /**
   * Probabilidad del idioma detectado
   */
  languageProbability: number;

  /**
   * Error si ocurrió
   */
  error: Error | null;

  /**
   * True si está grabando
   */
  isRecording: boolean;

  /**
   * True si está transcribiendo
   */
  isTranscribing: boolean;

  /**
   * Duración de la grabación actual en segundos (aproximada)
   */
  recordingDuration: number;
}

/**
 * Hook para Speech-to-Text con Faster-Whisper Large-v3-Turbo
 *
 * NUEVA FUNCIONALIDAD:
 * - Antes: No había STT implementado
 * - Ahora: Backend FastAPI en http://localhost:8000/api/stt con Faster-Whisper
 *
 * Ejemplo de uso (Modo Live Chat):
 * ```typescript
 * const {
 *   startRecording,
 *   stopRecording,
 *   text,
 *   isRecording,
 *   isTranscribing,
 *   error
 * } = useSTT({
 *   onSuccess: (response) => {
 *     console.log(`Detectado: ${response.language}`)
 *     console.log(`Texto: ${response.text}`)
 *   }
 * })
 *
 * const handleStartRecording = async () => {
 *   try {
 *     await startRecording()
 *   } catch (err) {
 *     console.error("Error al iniciar grabación:", err)
 *   }
 * }
 *
 * const handleStopRecording = async () => {
 *   try {
 *     const result = await stopRecording()
 *     console.log("Transcripción:", result.text)
 *   } catch (err) {
 *     console.error("Error al transcribir:", err)
 *   }
 * }
 *
 * return (
 *   <>
 *     <button onClick={handleStartRecording} disabled={isRecording || isTranscribing}>
 *       {isRecording ? "Grabando..." : "Grabar"}
 *     </button>
 *     <button onClick={handleStopRecording} disabled={!isRecording}>
 *       Detener
 *     </button>
 *     {isTranscribing && <p>Transcribiendo...</p>}
 *     {text && <p>Texto: {text}</p>}
 *     {error && <div style={{color: 'red'}}>{error.message}</div>}
 *   </>
 * )
 * ```
 */
export const useSTT = (options: UseSTTOptions = {}): UseSTTReturn => {
  const { onSuccess, onError, onRecordingEnd } = options;

  // State
  const [text, setText] = useState<string>("");
  const [detectedLanguage, setDetectedLanguage] = useState<string>("");
  const [languageProbability, setLanguageProbability] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);

  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Inicializar grabador
  if (!recorderRef.current) {
    recorderRef.current = new AudioRecorder();
  }

  // Iniciar grabación
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setText("");
      setDetectedLanguage("");
      setLanguageProbability(0);
      setRecordingDuration(0);

      await recorderRef.current?.startRecording();

      setIsRecording(true);
      recordingStartTimeRef.current = Date.now();

      // Actualizar duración cada 100ms
      recordingTimerRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
          setRecordingDuration(Math.round(duration * 10) / 10);
        }
      }, 100);

      console.log("🎙️ Grabación iniciada...");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsRecording(false);
      onError?.(error);
      console.error("❌ Error al iniciar grabación:", error.message);
      throw error;
    }
  }, [onError]);

  // Detener grabación y transcribir
  const stopRecording = useCallback(async (): Promise<STTResponse> => {
    if (!isRecording) {
      const err = new Error("No hay grabación en progreso");
      setError(err);
      throw err;
    }

    try {
      // Detener timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      setIsRecording(false);
      setIsTranscribing(true);

      console.log(
        `⏹️ Grabación detenida (${recordingDuration}s). Transcribiendo...`
      );

      // Obtener audio
      const audioBlob = await recorderRef.current?.stopRecording();

      if (!audioBlob) {
        throw new Error("No se pudo obtener audio grabado");
      }

      // Transcribir
      abortControllerRef.current = new AbortController();

      const result = await apiService.transcribeAudio(audioBlob);

      if (abortControllerRef.current.signal.aborted) {
        throw new Error("Transcripción cancelada");
      }

      // Guardar resultados
      setText(result.text);
      setDetectedLanguage(result.language);
      setLanguageProbability(result.probability);

      console.log(
        `✓ Transcripción completada: "${result.text.substring(0, 50)}..." (${result.language})`
      );

      onSuccess?.(result);
      onRecordingEnd?.();

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (!abortControllerRef.current?.signal.aborted) {
        setError(error);
        onError?.(error);
        console.error("❌ Error STT:", error.message);
      }

      throw error;
    } finally {
      setIsTranscribing(false);
      recordingStartTimeRef.current = null;
      abortControllerRef.current = null;
    }
  }, [isRecording, recordingDuration, onSuccess, onError, onRecordingEnd]);

  // Cancelar grabación
  const cancelRecording = useCallback(() => {
    recorderRef.current?.cancelRecording();
    setIsRecording(false);
    setRecordingDuration(0);
    recordingStartTimeRef.current = null;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    console.log("Grabación cancelada");
  }, []);

  // Transcribir desde un Blob
  const transcribe = useCallback(
    async (audioBlob: Blob): Promise<STTResponse> => {
      if (audioBlob.size === 0) {
        const err = new Error("El archivo de audio está vacío");
        setError(err);
        onError?.(err);
        throw err;
      }

      try {
        setError(null);
        setText("");
        setDetectedLanguage("");
        setLanguageProbability(0);
        setIsTranscribing(true);

        console.log(`👂 Transcribiendo audio (${audioBlob.size} bytes)...`);

        abortControllerRef.current = new AbortController();

        const result = await apiService.transcribeAudio(audioBlob);

        if (abortControllerRef.current.signal.aborted) {
          throw new Error("Transcripción cancelada");
        }

        setText(result.text);
        setDetectedLanguage(result.language);
        setLanguageProbability(result.probability);

        console.log(
          `✓ Transcripción: "${result.text.substring(0, 50)}..." (${result.language})`
        );

        onSuccess?.(result);

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (!abortControllerRef.current?.signal.aborted) {
          setError(error);
          onError?.(error);
          console.error("❌ Error transcripción:", error.message);
        }

        throw error;
      } finally {
        setIsTranscribing(false);
        abortControllerRef.current = null;
      }
    },
    [onSuccess, onError]
  );

  // Cancelar
  const cancel = useCallback(() => {
    if (isRecording) {
      cancelRecording();
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsTranscribing(false);
  }, [isRecording, cancelRecording]);

  // Cleanup
  const cleanup = useCallback(() => {
    cancel();

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    recorderRef.current?.cancelRecording();
  }, [cancel]);

  // Cleanup en desmontaje
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    startRecording,
    stopRecording,
    cancelRecording,
    transcribe,
    cancel,
    text,
    detectedLanguage,
    languageProbability,
    error,
    isRecording,
    isTranscribing,
    recordingDuration,
  };
};
