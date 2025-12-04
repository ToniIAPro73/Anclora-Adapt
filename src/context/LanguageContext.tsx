/**
 * src/context/LanguageContext.tsx
 *
 * Contexto para gestión de idioma (es/en)
 * Persiste en localStorage automáticamente
 *
 * FASE 1.1 - Refactorización de Frontend
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { InterfaceLanguage, LanguageContextType } from "@/types";

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = "anclora-language";
const DEFAULT_LANGUAGE: InterfaceLanguage = "es";

export interface LanguageProviderProps {
  children: ReactNode;
}

/**
 * Proveedor de contexto para idioma
 * Lee del localStorage en inicio y persiste cambios automáticamente
 */
export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<InterfaceLanguage>(() => {
    // Leer del localStorage en la inicialización
    const stored = localStorage.getItem(
      LANGUAGE_STORAGE_KEY
    ) as InterfaceLanguage | null;
    return stored || DEFAULT_LANGUAGE;
  });

  // Persistir cambios a localStorage
  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const setLanguage = (newLanguage: InterfaceLanguage) => {
    setLanguageState(newLanguage);
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};

/**
 * Hook para acceder al contexto de idioma
 * Lanza error si se usa fuera del proveedor
 */
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error(
      "useLanguage debe ser usado dentro de <LanguageProvider>"
    );
  }
  return context;
};
