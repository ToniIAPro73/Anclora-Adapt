import React, { useEffect, useState } from "react";
import type { InterfaceLanguage } from "@/types";
import { languages } from "@/constants/options";
import type { LanguageOptionAvailability } from "@/constants/modelCapabilities";
import { useModeState } from "@/context/useContextSelectors";

/**
 * Custom hook for IntelligentMode local state management
 * Handles: idea, context, language, deep thinking, image generation, etc.
 */
export const useIntelligentModeState = (
  interfaceLanguage: InterfaceLanguage,
  languageOptions: LanguageOptionAvailability[]
) => {
  // UI state
  const {
    isLoading,
    error,
    outputs,
    setError,
    imageUrl,
    setImageUrl,
  } = useModeState();

  // Local state
  const [idea, setIdea] = useState("");
  const [context, setContext] = useState("");
  const [language, setLanguage] = useState<string>(interfaceLanguage);
  const [deepThinking, setDeepThinking] = useState(false);
  const [includeImage, setIncludeImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Set image URL to null on mount
  useEffect(() => setImageUrl(null), [setImageUrl]);

  // Sync language with interface language
  useEffect(() => setLanguage(interfaceLanguage), [interfaceLanguage]);

  // Normalize language options
  const normalizedLanguageOptions =
    languageOptions?.length > 0
      ? languageOptions
      : languages.map((lang) => ({ ...lang, disabled: false }));

  // Validate language option is available
  useEffect(() => {
    if (
      !normalizedLanguageOptions.some(
        (option) => option.value === language && !option.disabled
      )
    ) {
      const fallback =
        normalizedLanguageOptions.find((option) => !option.disabled)?.value ||
        "es";
      if (fallback && fallback !== language) {
        setLanguage(fallback);
      }
    }
  }, [normalizedLanguageOptions, language]);

  // Cleanup blob URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Helper functions
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
    } else {
      setImagePreview(null);
    }
  };

  return {
    // UI state
    isLoading,
    error,
    outputs,
    setError,
    imageUrl,
    setImageUrl,
    // Local state
    idea,
    setIdea,
    context,
    setContext,
    language,
    setLanguage,
    deepThinking,
    setDeepThinking,
    includeImage,
    setIncludeImage,
    imagePrompt,
    setImagePrompt,
    imageFile,
    imagePreview,
    isMobile,
    // Computed
    normalizedLanguageOptions,
    // Handlers
    handleFileChange,
  };
};
