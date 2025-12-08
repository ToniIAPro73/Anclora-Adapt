/**
 * src/context/MediaContext.tsx
 *
 * Manages media state: uploaded files, audio blobs
 * Used by: Image/TTS specific mode components
 *
 * Features:
 * - Memoized context value for performance
 * - Isolated from UI and model state
 * - Minimal state (only 2 properties)
 *
 * This is the LEAST USED context - isolates media changes from other components
 */

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
} from "react";

export interface MediaContextType {
  // State
  selectedFile: File | null;
  audioBlob: Blob | null;

  // Setters
  setSelectedFile: (file: File | null) => void;
  setAudioBlob: (blob: Blob | null) => void;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export interface MediaProviderProps {
  children: ReactNode;
}

/**
 * Provider for media state (files, audio blobs)
 */
export const MediaProvider: React.FC<MediaProviderProps> = ({ children }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // CRITICAL: Memoize value object - only recreate when dependencies change
  const value = useMemo(
    () => ({
      selectedFile,
      audioBlob,
      setSelectedFile,
      setAudioBlob,
    }),
    [selectedFile, audioBlob]
  );

  return (
    <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
  );
};

/**
 * Hook to access media context
 * Throws error if used outside MediaProvider
 */
export const useMediaContext = (): MediaContextType => {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error("useMediaContext must be used within MediaProvider");
  }
  return context;
};
