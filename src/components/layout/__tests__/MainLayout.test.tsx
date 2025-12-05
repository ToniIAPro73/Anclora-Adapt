import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MainLayout from "../MainLayout";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { InteractionProvider } from "@/context/InteractionContext";
import type { AppMode } from "@/types";

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <ThemeProvider>
      <LanguageProvider>
        <InteractionProvider>{ui}</InteractionProvider>
      </LanguageProvider>
    </ThemeProvider>
  );

const tabs: { id: AppMode; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "intelligent", label: "Intelligent" },
];

const modelCopy = {
  label: "Modelo de texto",
  current: "Modelo en uso",
  refresh: "Actualizar modelos",
  loading: "Actualizando...",
  reset: "Reset",
  error: "",
};

const createHelpConfig = () => ({
  isOpen: false,
  title: "Ayuda rápida",
  description: "Explora cada modo",
  tips: ["Tip 1"],
  openLabel: "Abrir ayuda",
  closeLabel: "Cerrar ayuda",
  onOpen: vi.fn(),
  onClose: vi.fn(),
});

describe("MainLayout", () => {
  it("llama a onTabChange cuando se selecciona otra pestaña", () => {
    const onTabChange = vi.fn();
    renderWithProviders(
      <MainLayout
        tabs={tabs}
        modelOptions={["auto", "llama2"]}
        modelCopy={modelCopy}
        textModelId="auto"
        onTextModelChange={() => {}}
        onRefreshModels={async () => {}}
        isRefreshingModels={false}
        onTabChange={onTabChange}
        onReset={() => {}}
        help={createHelpConfig()}
      >
        <div>Contenido</div>
      </MainLayout>
    );

    fireEvent.click(screen.getByRole("tab", { name: /Intelligent/i }));
    expect(onTabChange).toHaveBeenCalledWith("intelligent");
  });

  it("actualiza el texto del botón de idioma al alternar", () => {
    renderWithProviders(
      <MainLayout
        tabs={tabs}
        modelOptions={["auto", "llama2"]}
        modelCopy={modelCopy}
        textModelId="auto"
        onTextModelChange={() => {}}
        onRefreshModels={async () => {}}
        isRefreshingModels={false}
        onTabChange={() => {}}
        onReset={() => {}}
        help={createHelpConfig()}
      >
        <div>Contenido</div>
      </MainLayout>
    );

    const languageButton = screen.getByLabelText(/Cambiar idioma/i);
    expect(languageButton).toHaveTextContent("ES");
    fireEvent.click(languageButton);
    expect(languageButton).toHaveTextContent("EN");
  });
});
