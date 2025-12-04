/**
 * src/hooks/useTextModel.ts
 *
 * Hook para generación de texto usando Ollama
 * Maneja carga, errores, y cancelación de peticiones
 *
 * FASE 1.3 - Custom Hooks
 */

import { useState, useCallback } from "react";
import { apiService } from "@/services/api";

interface UseTextModelOptions {
  /**
   * ID del modelo a usar (ej: "llama2", "mistral")
   * Si no se proporciona, usa el configurado en .env.local
   */
  modelId?: string;

  /**
   * Callback cuando se completa la generación
   */
  onSuccess?: (text: string) => void;

  /**
   * Callback cuando ocurre un error
   */
  onError?: (error: Error) => void;
}

interface UseTextModelReturn {
  /**
   * Genera texto a partir de un prompt
   */
  generate: (prompt: string) => Promise<string>;

  /**
   * Cancela la generación en progreso
   */
  cancel: () => void;

  /**
   * Texto generado (resultado del último generate)
   */
  result: string;

  /**
   * Error si ocurrió durante la generación
   */
  error: Error | null;

  /**
   * True si hay una generación en progreso
   */
  isLoading: boolean;
}

/**
 * Hook para generación de texto con Ollama
 *
 * Ejemplo de uso:
 * ```typescript
 * const { generate, result, isLoading, error } = useTextModel('llama2')
 *
 * const handleGenerate = async () => {
 *   const text = await generate("¿Qué es la inteligencia artificial?")
 *   console.log(text)
 * }
 *
 * return (
 *   <>
 *     <button onClick={handleGenerate} disabled={isLoading}>
 *       {isLoading ? "Generando..." : "Generar"}
 *     </button>
 *     {error && <div style={{color: 'red'}}>{error.message}</div>}
 *     {result && <p>{result}</p>}
 *   </>
 * )
 * ```
 */
export const useTextModel = (
  options: UseTextModelOptions = {}
): UseTextModelReturn => {
  const { modelId, onSuccess, onError } = options;

  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Para poder cancelar la petición
  let abortController: AbortController | null = null;

  const generate = useCallback(
    async (prompt: string): Promise<string> => {
      if (!prompt || prompt.trim().length === 0) {
        const err = new Error("El prompt no puede estar vacío");
        setError(err);
        onError?.(err);
        throw err;
      }

      try {
        // Crear nuevo AbortController para esta petición
        abortController = new AbortController();

        setIsLoading(true);
        setError(null);
        setResult("");

        const text = await apiService.generateText(prompt, modelId);

        if (abortController.signal.aborted) {
          throw new Error("Generación cancelada");
        }

        setResult(text);
        onSuccess?.(text);
        return text;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (!abortController?.signal.aborted) {
          setError(error);
          onError?.(error);
        }

        throw error;
      } finally {
        setIsLoading(false);
        abortController = null;
      }
    },
    [modelId, onSuccess, onError]
  );

  const cancel = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
    setIsLoading(false);
  }, []);

  return {
    generate,
    cancel,
    result,
    error,
    isLoading,
  };
};
