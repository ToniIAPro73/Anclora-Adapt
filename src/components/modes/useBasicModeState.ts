import React, { useEffect, useRef, useState } from "react";
import type { InterfaceLanguage } from "@/types";
import { languages } from "@/constants/options";
import type { LanguageOptionAvailability } from "@/constants/modelCapabilities";
import { useModeState } from "@/context/useContextSelectors";

/**
 * Custom hook for BasicMode local state management
 * Handles: idea, language, tone, platforms, file uploads, min/max chars, etc.
 */
export const useBasicModeState = (
  interfaceLanguage: InterfaceLanguage,
  languageOptions: LanguageOptionAvailability[]
) => {
  // UI state
  const {
    isLoading,
    error,
    outputs,
    setError,
    setIsLoading: _setIsLoading,
    imageUrl: _imageUrl,
    setImageUrl: _setImageUrl,
  } = useModeState();

  // Local state
  const [idea, setIdea] = useState("");
  const [language, setLanguage] = useState("es");
  const [tone, setTone] = useState("detect");
  const [platforms, setPlatforms] = useState<string[]>([
    "LinkedIn",
    "Instagram",
  ]);
  const [speed, _setSpeed] = useState<"detailed" | "flash">("detailed");
  const [literalTranslation, setLiteralTranslation] = useState(false);
  const [minChars, setMinChars] = useState("");
  const [maxChars, setMaxChars] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedText, setUploadedText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Set image URL to null on mount
  useEffect(() => _setImageUrl(null), [_setImageUrl]);

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

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Helper functions
  const togglePlatform = (value: string) => {
    setPlatforms((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const normalizedName = file.name?.toLowerCase() ?? "";
    const allowedExtensions = [
      ".txt",
      ".md",
      ".markdown",
      ".csv",
      ".log",
      ".json",
    ];
    const isTextType =
      file.type.startsWith("text/") ||
      allowedExtensions.some((ext) => normalizedName.endsWith(ext));
    if (!isTextType) {
      setError("El archivo debe ser de texto (.txt, .md, .csv, .log).");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setUploadedText(text);
      setUploadedFileName(file.name);
      setError(null);
      event.target.value = "";
    };
    reader.onerror = () => {
      setError("No se pudo leer el archivo. Intenta con otro formato de texto.");
      event.target.value = "";
    };
    reader.readAsText(file);
  };

  return {
    // UI state
    isLoading,
    error,
    outputs,
    setError,
    _setIsLoading,
    _imageUrl,
    _setImageUrl,
    // Local state
    idea,
    setIdea,
    language,
    setLanguage,
    tone,
    setTone,
    platforms,
    setPlatforms,
    speed,
    literalTranslation,
    setLiteralTranslation,
    minChars,
    setMinChars,
    maxChars,
    setMaxChars,
    isMobile,
    uploadedFileName,
    setUploadedFileName,
    uploadedText,
    setUploadedText,
    fileInputRef,
    // Computed
    normalizedLanguageOptions,
    // Handlers
    togglePlatform,
    handleFileUploadClick,
    handleFileSelected,
  };
};
