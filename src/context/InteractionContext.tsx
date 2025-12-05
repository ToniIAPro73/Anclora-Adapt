/**
 * src/context/InteractionContext.tsx
 *
 * Contexto global unificado para la aplicación
 * Centraliza: modo activo, input/outputs, estados de carga, selección de modelo
 *
 * FASE 1.1 - Refactorización de Frontend
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type {
  InteractionContextType,
  AppMode,
  GeneratedOutput,
} from "@/types";
import { DEFAULT_TEXT_MODEL_ID } from "@/config";

const InteractionContext = createContext<InteractionContextType | undefined>(
  undefined
);

const TEXT_MODEL_STORAGE_KEY = "anclora.textModel";

export interface InteractionProviderProps {
  children: ReactNode;
}

/**
 * Proveedor del contexto de interacción global
 * Envuelve la aplicación para proporcionar acceso a estado global sin prop drilling
 */
export const InteractionProvider: React.FC<InteractionProviderProps> = ({
  children,
}) => {
  // Mode & UI State
  const [activeMode, setActiveMode] = useState<AppMode>("basic");
  const [currentInput, setCurrentInput] = useState<string>("");
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([]);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Model Selection
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TEXT_MODEL_STORAGE_KEY, selectedModel);
    }
  }, [selectedModel]);

  // Media (for image/voice modes)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Helper functions
  const addOutput = (output: GeneratedOutput) => {
    setOutputs((prev) => [...prev, output]);
  };

  const clearOutputs = () => {
    setOutputs([]);
  };

  const value: InteractionContextType = {
    // Mode & Theme
    activeMode,
    setActiveMode,

    // Input & Output
    currentInput,
    setCurrentInput,
    outputs,
    addOutput,
    clearOutputs,

    // Loading & Error States
    isLoading,
    setIsLoading,
    error,
    setError,

    // Model Selection
    selectedModel,
    setSelectedModel: setSelectedModelState,
    lastModelUsed,
    setLastModelUsed,

    // Media
    selectedFile,
    setSelectedFile,
    audioBlob,
    setAudioBlob,

    imageUrl,
    setImageUrl,
  };

  return (
    <InteractionContext.Provider value={value}>
      {children}
    </InteractionContext.Provider>
  );
};

/**
 * Hook para acceder al contexto de interacción
 * Lanza error si se usa fuera del proveedor
 */
export const useInteraction = (): InteractionContextType => {
  const context = useContext(InteractionContext);
  if (!context) {
    throw new Error(
      "useInteraction debe ser usado dentro de <InteractionProvider>"
    );
  }
  return context;
};
