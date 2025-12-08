/**
 * src/context/useContextSelectors.ts
 *
 * Specialized hooks that combine contexts or select specific slices
 * Provides optimized access patterns for common use cases
 *
 * These hooks prevent unnecessary re-renders by only subscribing to
 * the specific state properties each component actually needs
 */

import { useMemo } from "react";
import { useUIContext } from "./UIContext";
import { useModelContext } from "./ModelContext";
import { useMediaContext } from "./MediaContext";

/**
 * Hook for mode components - ONLY provides UI state
 * Used by: BasicMode, IntelligentMode, CampaignMode, RecycleMode
 *
 * Returns: isLoading, error, outputs, imageUrl + setters + helpers
 *
 * Performance: Prevents re-renders on model selection, hardware changes, or media changes
 */
export const useModeState = () => {
  const {
    isLoading,
    error,
    outputs,
    imageUrl,
    setIsLoading,
    setError,
    setImageUrl,
    addOutput,
    clearOutputs,
  } = useUIContext();

  return useMemo(
    () => ({
      isLoading,
      error,
      outputs,
      imageUrl,
      setIsLoading,
      setError,
      setImageUrl,
      addOutput,
      clearOutputs,
    }),
    [
      isLoading,
      error,
      outputs,
      imageUrl,
      setIsLoading,
      setError,
      setImageUrl,
      addOutput,
      clearOutputs,
    ]
  );
};

/**
 * Hook for MainLayout - ONLY provides mode and last model
 * Used by: MainLayout
 *
 * Returns: activeMode, lastModelUsed
 *
 * Performance: Prevents re-renders on outputs, loading, errors, or media changes
 */
export const useLayoutState = () => {
  const { activeMode } = useUIContext();
  const { lastModelUsed } = useModelContext();

  return useMemo(
    () => ({
      activeMode,
      lastModelUsed,
    }),
    [activeMode, lastModelUsed]
  );
};

/**
 * Legacy hook - provides everything from all contexts
 * Used by: App.tsx (temporary during migration)
 *
 * This is a temporary hook for backward compatibility during the migration.
 * Eventually App.tsx should be updated to use specific contexts directly.
 *
 * @deprecated Use useModelContext, useUIContext, or useMediaContext instead
 */
export const useInteraction = () => {
  const modelContext = useModelContext();
  const uiContext = useUIContext();
  const mediaContext = useMediaContext();

  return useMemo(
    () => ({
      ...modelContext,
      ...uiContext,
      ...mediaContext,
      // Deprecated fields (not used anywhere - can be removed later)
      currentInput: "",
      setCurrentInput: () => {},
    }),
    [modelContext, uiContext, mediaContext]
  );
};
