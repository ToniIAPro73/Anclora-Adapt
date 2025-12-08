/**
 * src/context/ModelContext.tsx
 *
 * Manages model selection and hardware profile state
 * Used by: App.tsx, MainLayout (via selector)
 *
 * Features:
 * - selectedModel persisted to localStorage
 * - Memoized context value for performance
 * - Independent from UI/loading/output state
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import type { SystemCapabilities } from "@/types";
import { DEFAULT_TEXT_MODEL_ID } from "@/config";

const TEXT_MODEL_STORAGE_KEY = "anclora.textModel";

export interface ModelContextType {
  // State
  selectedModel: string;
  lastModelUsed: string | null;
  hardwareProfile: SystemCapabilities | null;

  // Setters
  setSelectedModel: (model: string) => void;
  setLastModelUsed: (model: string | null) => void;
  setHardwareProfile: (profile: SystemCapabilities | null) => void;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export interface ModelProviderProps {
  children: ReactNode;
}

/**
 * Provider for model selection and hardware state
 * Handles localStorage persistence for selectedModel
 */
export const ModelProvider: React.FC<ModelProviderProps> = ({ children }) => {
  // Initialize selectedModel from localStorage
  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_TEXT_MODEL_ID;
    }
    return (
      window.localStorage.getItem(TEXT_MODEL_STORAGE_KEY) ||
      DEFAULT_TEXT_MODEL_ID
    );
  });

  const [lastModelUsed, setLastModelUsed] = useState<string | null>(null);
  const [hardwareProfile, setHardwareProfile] =
    useState<SystemCapabilities | null>(null);

  // Persist selectedModel to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TEXT_MODEL_STORAGE_KEY, selectedModel);
    }
  }, [selectedModel]);

  // CRITICAL: Memoize value object - only recreate when dependencies change
  const value = useMemo(
    () => ({
      selectedModel,
      lastModelUsed,
      hardwareProfile,
      setSelectedModel: setSelectedModelState,
      setLastModelUsed,
      setHardwareProfile,
    }),
    [selectedModel, lastModelUsed, hardwareProfile]
  );

  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
};

/**
 * Hook to access model context
 * Throws error if used outside ModelProvider
 */
export const useModelContext = (): ModelContextType => {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error("useModelContext must be used within ModelProvider");
  }
  return context;
};
