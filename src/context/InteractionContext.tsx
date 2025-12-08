/**
 * src/context/InteractionContext.tsx
 *
 * DEPRECATED: Legacy wrapper for backward compatibility
 *
 * This file has been refactored into three specialized contexts:
 * - ModelContext: Model selection and hardware profile
 * - UIContext: Loading/error/outputs/mode state
 * - MediaContext: File/audio state
 *
 * This file now acts as a compatibility layer during migration.
 * Eventually this entire file should be removed once all components
 * are migrated to use the specialized contexts directly.
 *
 * PHASE 1.2 - Context Splitting Refactoring
 */

import React, { useMemo, ReactNode } from "react";
import type { InteractionContextType } from "@/types";
import { useModelContext } from "./ModelContext";
import { useUIContext } from "./UIContext";
import { useMediaContext } from "./MediaContext";

const InteractionContext = React.createContext<
  InteractionContextType | undefined
>(undefined);

export interface InteractionProviderProps {
  children: ReactNode;
}

/**
 * @deprecated
 * Legacy provider for backward compatibility
 * This provider no longer manages state directly - it composes the three new contexts
 */
export const InteractionProvider: React.FC<InteractionProviderProps> = ({
  children,
}) => {
  const modelContext = useModelContext();
  const uiContext = useUIContext();
  const mediaContext = useMediaContext();

  // Compose the legacy context from three specialized contexts
  const value = useMemo(
    () => ({
      // Model state
      selectedModel: modelContext.selectedModel,
      setSelectedModel: modelContext.setSelectedModel,
      lastModelUsed: modelContext.lastModelUsed,
      setLastModelUsed: modelContext.setLastModelUsed,
      hardwareProfile: modelContext.hardwareProfile,
      setHardwareProfile: modelContext.setHardwareProfile,

      // UI state
      activeMode: uiContext.activeMode,
      setActiveMode: uiContext.setActiveMode,
      outputs: uiContext.outputs,
      addOutput: uiContext.addOutput,
      clearOutputs: uiContext.clearOutputs,
      isLoading: uiContext.isLoading,
      setIsLoading: uiContext.setIsLoading,
      error: uiContext.error,
      setError: uiContext.setError,
      imageUrl: uiContext.imageUrl,
      setImageUrl: uiContext.setImageUrl,

      // Media state
      selectedFile: mediaContext.selectedFile,
      setSelectedFile: mediaContext.setSelectedFile,
      audioBlob: mediaContext.audioBlob,
      setAudioBlob: mediaContext.setAudioBlob,

      // Deprecated/unused fields
      currentInput: "",
      setCurrentInput: () => {},
    }),
    [modelContext, uiContext, mediaContext]
  );

  return (
    <InteractionContext.Provider value={value}>
      {children}
    </InteractionContext.Provider>
  );
};

/**
 * @deprecated Use useModelContext, useUIContext, or useMediaContext instead
 * Hook para acceder al contexto de interacción (legacy)
 * Lanza error si se usa fuera del proveedor
 */
export const useInteraction = (): InteractionContextType => {
  const context = React.useContext(InteractionContext);
  if (!context) {
    throw new Error(
      "useInteraction debe ser usado dentro de <InteractionProvider>"
    );
  }
  return context;
};
