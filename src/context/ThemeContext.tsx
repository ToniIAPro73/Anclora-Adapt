/**
 * src/context/ThemeContext.tsx
 *
 * Contexto para gestión de tema (light/dark/system)
 * Persiste en localStorage automáticamente
 *
 * FASE 1.1 - Refactorización de Frontend
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { ThemeMode, ThemeContextType } from "@/types";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "anclora-theme";
const DEFAULT_THEME: ThemeMode = "light";

export interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Proveedor de contexto para tema
 * Lee del localStorage en inicio y persiste cambios automáticamente
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    // Leer del localStorage en la inicialización
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    return stored || DEFAULT_THEME;
  });

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Actualizar el DOM y isDarkMode cuando cambia el tema
  useEffect(() => {
    const root = document.documentElement;

    if (theme === "system") {
      // Detectar preferencia del sistema
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      root.setAttribute("data-theme", prefersDark ? "dark" : "light");
      setIsDarkMode(prefersDark);
    } else {
      root.setAttribute("data-theme", theme);
      setIsDarkMode(theme === "dark");
    }

    // Guardar en localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Escuchar cambios del sistema cuando está en modo "system"
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      root.setAttribute("data-theme", e.matches ? "dark" : "light");
      setIsDarkMode(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const value: ThemeContextType = {
    theme,
    setTheme,
    isDarkMode,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

/**
 * Hook para acceder al contexto de tema
 * Lanza error si se usa fuera del proveedor
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme debe ser usado dentro de <ThemeProvider>");
  }
  return context;
};
