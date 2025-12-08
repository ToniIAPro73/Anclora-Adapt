/**
 * Hook for image analysis using CLIP + Ollama backend
 * Analyzes uploaded images and generates prompts for image generation
 */

import { useState, useCallback } from "react";

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

        const endpoint = useStreaming
          ? `${API_BASE_URL}/api/images/analyze-stream`
          : `${API_BASE_URL}/api/images/analyze`;

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

      const result = (await response.json()) as AnalysisResult;

      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        generatedPrompt: result.generatedPrompt || "",
        analysis: result.analysis || null,
        error: result.success ? null : result.error || "Analysis failed",
      }));

      return result;
    },
    []
  );

  /**
   * Streaming analysis (progressive updates via SSE)
   */
  const analyzeImageStream = useCallback(
    async (formData: FormData): Promise<AnalysisResult> => {
      return new Promise((resolve, reject) => {
        const eventSource = new EventSource(
          `${API_BASE_URL}/api/images/analyze-stream`,
          { method: "POST", body: formData } as any
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

              case "complete":
                finalResult = {
                  success: true,
                  generatedPrompt: data.generatedPrompt || "",
                  analysis: data.analysis,
                };
                setState((prev) => ({
                  ...prev,
                  isAnalyzing: false,
                  generatedPrompt: data.generatedPrompt || "",
                  error: null,
                }));
                eventSource.close();
                resolve(finalResult);
                break;

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
