/**
 * src/hooks/useImageGeneration.ts
 *
 * Hook para generación de imágenes usando SDXL Lightning desde backend FastAPI
 * Maneja generación, descarga y cancelación
 *
 * ⚠️ MEJORA CRÍTICA: Reemplaza el antiguo placeholder lento
 * Usa el backend Python FastAPI en http://localhost:8000/api/image
 * Tiempo mejorado: 30-60s → 8-15s con SDXL Lightning 4-step
 *
 * FASE 1.3 - Custom Hooks
 */

import { useState, useCallback, useRef } from "react";
import { apiService } from "@/services/api";
import { downloadImage, generateImageFilename } from "@/services/image";

interface UseImageGenerationOptions {
  /**
   * Dimensiones por defecto
   */
  defaultWidth?: number;
  defaultHeight?: number;

  /**
   * Pasos de inferencia (default: 4 para SDXL Lightning)
   */
  defaultSteps?: number;

  /**
   * Callback cuando se completa la generación
   */
  onSuccess?: (imageBlob: Blob) => void;

  /**
   * Callback cuando ocurre un error
   */
  onError?: (error: Error) => void;
}

interface UseImageGenerationReturn {
  /**
   * Genera una imagen a partir de un prompt
   */
  generate: (
    prompt: string,
    negativePrompt?: string,
    width?: number,
    height?: number,
    steps?: number
  ) => Promise<Blob>;

  /**
   * Descarga la imagen actual
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
   * Imagen generada
   */
  imageBlob: Blob | null;

  /**
   * URL de objeto para previsualizar la imagen (use con <img src={imageUrl} />)
   */
  imageUrl: string | null;

  /**
   * Error si ocurrió
   */
  error: Error | null;

  /**
   * True si hay una generación en progreso
   */
  isGenerating: boolean;

  /**
   * Progreso estimado (0-100)
   * Nota: Es aproximado basado en timing estimado
   */
  progress: number;

  /**
   * Prompt usado en la última generación
   */
  lastPrompt: string;
}

/**
 * Hook para generación de imágenes con SDXL Lightning
 *
 * MEJORA CRÍTICA vs Stable Diffusion 1.5:
 * - Antes: ~30-60 segundos, baja calidad
 * - Ahora: ~8-15 segundos, mejor calidad con SDXL
 *
 * Ejemplo de uso (Modo Imagen):
 * ```typescript
 * const {
 *   generate,
 *   download,
 *   imageBlob,
 *   imageUrl,
 *   isGenerating,
 *   progress,
 *   error
 * } = useImageGeneration({
 *   defaultWidth: 1024,
 *   defaultHeight: 1024
 * })
 *
 * const handleGenerate = async () => {
 *   try {
 *     const prompt = "Un gato astronauta en el espacio, estilo digital art"
 *     const negativePrompt = "baja calidad, borroso, distorsionado"
 *
 *     await generate(
 *       prompt,
 *       negativePrompt,
 *       1024,  // width
 *       1024,  // height
 *       4      // steps (SDXL Lightning siempre 4)
 *     )
 *   } catch (err) {
 *     console.error("Error:", err)
 *   }
 * }
 *
 * return (
 *   <>
 *     <textarea
 *       placeholder="Describe la imagen que deseas..."
 *       onChange={(e) => setPrompt(e.target.value)}
 *     />
 *
 *     <button onClick={handleGenerate} disabled={isGenerating}>
 *       {isGenerating ? `Generando... ${progress}%` : "Generar"}
 *     </button>
 *
 *     {imageUrl && (
 *       <>
 *         <img src={imageUrl} alt="Generated" style={{maxWidth: '100%'}} />
 *         <button onClick={() => download()}>Descargar</button>
 *       </>
 *     )}
 *
 *     {error && <div style={{color: 'red'}}>{error.message}</div>}
 *   </>
 * )
 * ```
 */
export const useImageGeneration = (
  options: UseImageGenerationOptions = {}
): UseImageGenerationReturn => {
  const {
    defaultWidth = 1024,
    defaultHeight = 1024,
    defaultSteps = 4,
    onSuccess,
    onError,
  } = options;

  // State
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [lastPrompt, setLastPrompt] = useState<string>("");

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generar imagen
  const generate = useCallback(
    async (
      prompt: string,
      negativePrompt?: string,
      width: number = defaultWidth,
      height: number = defaultHeight,
      steps: number = defaultSteps
    ): Promise<Blob> => {
      if (!prompt || prompt.trim().length === 0) {
        const err = new Error("El prompt no puede estar vacío");
        setError(err);
        onError?.(err);
        throw err;
      }

      try {
        // Limpiar
        if (imageUrl) {
          URL.revokeObjectURL(imageUrl);
        }

        abortControllerRef.current = new AbortController();

        setIsGenerating(true);
        setError(null);
        setImageBlob(null);
        setImageUrl(null);
        setProgress(0);
        setLastPrompt(prompt);

        console.log(
          `🎨 Generando imagen: "${prompt.substring(0, 50)}..." (${width}x${height}, ${steps} steps)`
        );

        // Simular progreso (0% al inicio)
        let simulatedProgress = 0;
        progressIntervalRef.current = setInterval(() => {
          // Progresión no lineal: rápido al principio, lento al final
          simulatedProgress = Math.min(simulatedProgress + Math.random() * 15, 90);
          setProgress(Math.round(simulatedProgress));
        }, 500);

        const blob = await apiService.generateImage(
          prompt,
          negativePrompt,
          width,
          height,
          steps
        );

        if (abortControllerRef.current.signal.aborted) {
          URL.revokeObjectURL(URL.createObjectURL(blob));
          throw new Error("Generación de imagen cancelada");
        }

        // Completar progreso
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setProgress(100);

        // Crear URL de objeto para previsualización
        const newImageUrl = URL.createObjectURL(blob);

        setImageBlob(blob);
        setImageUrl(newImageUrl);

        console.log(
          `✓ Imagen generada: ${blob.size} bytes, ${width}x${height}`
        );

        onSuccess?.(blob);
        return blob;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (!abortControllerRef.current?.signal.aborted) {
          setError(error);
          onError?.(error);
          console.error("❌ Error generación imagen:", error.message);
        }

        throw error;
      } finally {
        setIsGenerating(false);

        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        abortControllerRef.current = null;
      }
    },
    [defaultWidth, defaultHeight, defaultSteps, onSuccess, onError]
  );

  // Descargar
  const download = useCallback(
    (filename?: string) => {
      if (!imageBlob) {
        const err = new Error("No hay imagen para descargar");
        setError(err);
        throw err;
      }

      try {
        const finalFilename =
          filename || generateImageFilename("imagen-generada");
        downloadImage(imageBlob, finalFilename);
        console.log(`✓ Imagen descargada: ${finalFilename}`);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [imageBlob]
  );

  // Cancelar
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsGenerating(false);
    setProgress(0);

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    console.log("Generación cancelada");
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    cancel();

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  }, [cancel, imageUrl]);

  // Cleanup en desmontaje
  React.useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    generate,
    download,
    cancel,
    imageBlob,
    imageUrl,
    error,
    isGenerating,
    progress,
    lastPrompt,
  };
};
