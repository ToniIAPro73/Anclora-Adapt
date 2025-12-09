/**
 * Hook for image analysis using CLIP + Ollama backend
 * Analyzes uploaded images and generates prompts for image generation
 */

import { useState, useCallback } from "react";

export interface ImageContextResponse {
  generative_prompt?: string;
}

export interface ApiAnalysisResponse {
  success: boolean;
  generatedPrompt?: string;
  image_context?: ImageContextResponse;
  analysis?: Record<string, Array<{ value: string; score: number }>>;
  userInput?: string;
  error?: string;
}

export interface AnalysisResult {
  success: boolean;
  generatedPrompt: string;
  analysis?: Record<string, Array<{ value: string; score: number }>>;
  userInput?: string;
  error?: string;
}

export interface ImageAnalyzerState {
  isAnalyzing: boolean;
  error: string | null;
  generatedPrompt: string;
  analysis: Record<string, Array<{ value: string; score: number }>> | null;
}

interface SSEInit {
  method?: string;
  body?: BodyInit;
  headers?: Record<string, string>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const useImageAnalyzer = () => {
  const [state, setState] = useState<ImageAnalyzerState>({
    isAnalyzing: false,
    error: null,
    generatedPrompt: "",
    analysis: null,
  });

  /**
   * Analyzes uploaded image and generates prompt
   * Supports both regular and streaming analysis
   */
  const analyzeImage = useCallback(
    async (
      imageFile: File,
      userPrompt?: string,
      deepThinking?: boolean,
      language?: string,
      useStreaming: boolean = false
    ): Promise<AnalysisResult> => {
      setState((prev) => ({
        ...prev,
        isAnalyzing: true,
        error: null,
        generatedPrompt: "",
        analysis: null,
      }));

      try {
        const formData = new FormData();
        formData.append("image", imageFile);
        if (userPrompt) {
          formData.append("user_prompt", userPrompt);
        }
        formData.append("deep_thinking", deepThinking ? "true" : "false");
        if (language) {
          formData.append("language", language);
        }

        if (useStreaming) {
          return await analyzeImageStream(formData);
        } else {
          return await analyzeImageRegular(formData);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isAnalyzing: false,
        }));
        return {
          success: false,
          generatedPrompt: "",
          error: errorMessage,
        };
      }
    },
    []
  );

  /**
   * Regular analysis (single response)
   */
  const analyzeImageRegular = useCallback(
    async (formData: FormData): Promise<AnalysisResult> => {
      const response = await fetch(`${API_BASE_URL}/api/images/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Analysis failed: ${response.statusText} (${response.status})`
        );
      }

      const apiResponse = (await response.json()) as ApiAnalysisResponse;

      // Handle both old format (generatedPrompt) and new format (image_context.generative_prompt)
      const generatedPrompt =
        apiResponse.image_context?.generative_prompt ||
        apiResponse.generatedPrompt ||
        "";

      const normalizedResult: AnalysisResult = {
        success: apiResponse.success || false,
        generatedPrompt,
        analysis: apiResponse.analysis || null,
        error: apiResponse.success ? null : apiResponse.error || "Analysis failed",
      };

      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        generatedPrompt,
        analysis: normalizedResult.analysis,
        error: normalizedResult.error,
      }));

      return normalizedResult;
    },
    []
  );

  /**
   * Streaming analysis (progressive updates via SSE)
   */
  const analyzeImageStream = useCallback(
    async (formData: FormData): Promise<AnalysisResult> => {
      return new Promise((resolve, reject) => {
        const sseInit: SSEInit = {
          method: "POST",
          body: formData,
        };
        const eventSource = new EventSource(
          `${API_BASE_URL}/api/images/analyze-stream`,
          sseInit as EventSourceInit
        );

        let finalResult: AnalysisResult = {
          success: false,
          generatedPrompt: "",
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.status) {
              case "analyzing":
                setState((prev) => ({
                  ...prev,
                  error: data.message || "Analyzing...",
                }));
                break;

              case "analyzed":
                setState((prev) => ({
                  ...prev,
                  analysis: data.analysis || null,
                }));
                break;

              case "generating":
                setState((prev) => ({
                  ...prev,
                  error: data.message || "Generating prompt...",
                }));
                break;

              case "complete": {
                // Handle both old format (generatedPrompt) and new format (image_context.generative_prompt)
                const streamGeneratedPrompt =
                  data.image_context?.generative_prompt ||
                  data.generatedPrompt ||
                  "";
                finalResult = {
                  success: true,
                  generatedPrompt: streamGeneratedPrompt,
                  analysis: data.analysis,
                };
                setState((prev) => ({
                  ...prev,
                  isAnalyzing: false,
                  generatedPrompt: streamGeneratedPrompt,
                  error: null,
                }));
                eventSource.close();
                resolve(finalResult);
                break;
              }

              case "error":
                setState((prev) => ({
                  ...prev,
                  isAnalyzing: false,
                  error: data.error || "Unknown error",
                }));
                eventSource.close();
                reject(new Error(data.error || "Stream error"));
                break;
            }
          } catch (error) {
            console.error("Error parsing stream data:", error);
          }
        };

        eventSource.onerror = () => {
          setState((prev) => ({
            ...prev,
            isAnalyzing: false,
            error: "Connection error",
          }));
          eventSource.close();
          reject(new Error("Stream connection error"));
        };
      });
    },
    []
  );

  /**
   * Clear state
   */
  const reset = useCallback(() => {
    setState({
      isAnalyzing: false,
      error: null,
      generatedPrompt: "",
      analysis: null,
    });
  }, []);

  return {
    ...state,
    analyzeImage,
    reset,
  };
};
