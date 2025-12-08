/**
 * src/context/UIContext.tsx
 *
 * Manages UI state: loading, errors, outputs, mode selection
 * Used by: App.tsx, ALL mode components (BasicMode, IntelligentMode, etc.)
 *
 * Features:
 * - Memoized context value for performance
 * - useCallback for helper functions (stable references)
 * - Independent from model selection and media state
 *
 * This is the MOST USED context - mode components only need this
 */

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import type { AppMode, GeneratedOutput } from "@/types";

export interface UIContextType {
  // State
  isLoading: boolean;
  error: string | null;
  outputs: GeneratedOutput[];
  imageUrl: string | null;
  activeMode: AppMode;

  // Setters
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setImageUrl: (url: string | null) => void;
  setActiveMode: (mode: AppMode) => void;

  // Helper functions
  addOutput: (output: GeneratedOutput) => void;
  clearOutputs: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export interface UIProviderProps {
  children: ReactNode;
}

/**
 * Provider for UI state (loading, errors, outputs, active mode)
 */
export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<AppMode>("basic");

  // CRITICAL: useCallback for functions to maintain referential equality
  const addOutput = useCallback((output: GeneratedOutput) => {
    setOutputs((prev) => [...prev, output]);
  }, []);

  const clearOutputs = useCallback(() => {
    setOutputs([]);
  }, []);

  // CRITICAL: Memoize value object - only recreate when dependencies change
  const value = useMemo(
    () => ({
      isLoading,
      error,
      outputs,
      imageUrl,
      activeMode,
      setIsLoading,
      setError,
      setImageUrl,
      setActiveMode,
      addOutput,
      clearOutputs,
    }),
    [isLoading, error, outputs, imageUrl, activeMode, addOutput, clearOutputs]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

/**
 * Hook to access UI context
 * Throws error if used outside UIProvider
 */
export const useUIContext = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUIContext must be used within UIProvider");
  }
  return context;
};
