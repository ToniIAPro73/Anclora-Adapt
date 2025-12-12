import React from "react";
import { RefreshCw } from "lucide-react";
import commonStyles from "@/styles/commonStyles";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { useLayoutState } from "@/context/useContextSelectors";
import type { AppMode, ThemeMode, SystemCapabilities } from "@/types";
import { translations } from "@/constants/translations";

interface TabItem {
  id: AppMode;
  label: string;
}

interface ModelCopy {
  label: string;
  current: string;
  refresh: string;
  loading: string;
  reset: string;
  auto?: string;
  lastUsed?: string;
  hardwareAdjust?: string;
  hardwareAdjusting?: string;
  hardwareDetected?: string;
}

interface HelpConfig {
  isOpen: boolean;
  title: string;
  description: string;
  tips: string[];
  openLabel: string;
  closeLabel: string;
  onOpen: () => void;
  onClose: () => void;
}

interface MainLayoutProps {
  tabs: TabItem[];
  modelOptions: string[];
  modelCopy: ModelCopy;
  textModelId: string;
  onTextModelChange: (modelId: string) => void;
  onRefreshModels: () => Promise<void> | void;
  isRefreshingModels: boolean;
  hardwareProfile?: SystemCapabilities | null;
  modeAvailability?: Partial<Record<AppMode, { enabled: boolean; reason?: string }>>;
  onTabChange: (tabId: AppMode) => void;
  onReset: () => void;
  help: HelpConfig;
  executionStatus?: { message: string; notices?: string[] } | null;
  queueInfo?: {
    offline: boolean;
    pending: number;
    lastLabel?: string;
    lastError?: string | null;
    onRetry: () => void;
  };
  children: React.ReactNode;
}

const themeSequence: ThemeMode[] = ["light", "dark", "system"];

const getNextTheme = (theme: ThemeMode): ThemeMode => {
  const currentIndex = themeSequence.indexOf(theme);
  const nextIndex = (currentIndex + 1) % themeSequence.length;
  return themeSequence[nextIndex];
};

const MainLayout: React.FC<MainLayoutProps> = ({
  tabs,
  modelOptions,
  modelCopy,
  textModelId,
  onTextModelChange,
  onRefreshModels,
  isRefreshingModels,
  hardwareProfile,
  modeAvailability,
  onTabChange,
  onReset,
  help,
  executionStatus,
  queueInfo,
  children,
}) => {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { activeMode } = useLayoutState();
  const localizedCopy = translations[language];
  const themeIcon = theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "🖥️";
  const hardwareSummary = hardwareProfile?.hardware
    ? `${hardwareProfile.hardware.gpu_model} (${hardwareProfile.hardware.gpu_vram_gb} GB VRAM) · ${hardwareProfile.hardware.ram_gb} GB RAM`
    : null;

  return (
    <div style={commonStyles.mainContainer}>
      <header style={commonStyles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h1 style={commonStyles.headerTitle}>{localizedCopy.title}</h1>
          <p style={commonStyles.headerSubtitle}>
            {localizedCopy.subtitle}
          </p>
          {hardwareSummary && (
            <span
              style={{
                ...commonStyles.settingsHint,
                marginTop: "2px",
              }}
            >
              {hardwareSummary}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            flex: 1,
            minWidth: 0,
            width: "100%",
          }}
        >
          <div
            style={{
              ...commonStyles.headerActions,
              justifyContent: "flex-end",
              flexWrap: "nowrap",
            }}
          >
            <button
              type="button"
              onClick={() => setTheme(getNextTheme(theme))}
              style={commonStyles.themeButton}
              aria-label="Cambiar tema"
            >
              {themeIcon}
            </button>

            <button
              type="button"
              onClick={() => setLanguage(language === "es" ? "en" : "es")}
              style={commonStyles.languageToggle}
              title="Cambiar idioma / Switch language"
              aria-label="Cambiar idioma"
            >
              <span style={{ fontSize: "0.9em", fontWeight: 700 }}>
                {language.toUpperCase()}
              </span>
            </button>

            <button
              type="button"
              onClick={help.onOpen}
              style={commonStyles.helpButton}
              title={help.openLabel}
              aria-label={help.openLabel}
            >
              ?
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              gap: "2px",
              minWidth: 0,
            }}
          >
            <div style={commonStyles.settingsBar}>
              <div style={{ ...commonStyles.settingsGroup, flex: 1, minWidth: 0 }}>
                <label
                  htmlFor="text-model-select"
                  style={{ ...commonStyles.settingsLabel, flexShrink: 0 }}
                >
                  {modelCopy.label || "Modelo Texto"}
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    minWidth: 0,
                  }}
                >
                  <select
                    id="text-model-select"
                    value={textModelId}
                    onChange={(event) => onTextModelChange(event.target.value)}
                    style={{
                      ...commonStyles.select,
                      padding: "6px 10px",
                      fontSize: "0.9em",
                      flex: 1,
                      minWidth: "140px",
                      maxWidth: "240px",
                    }}
                  >
                    {modelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model === "auto" ? modelCopy.auto || "Auto" : model}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    style={{
                      ...commonStyles.resetButton,
                      padding: "6px 10px",
                      width: "38px",
                      height: "38px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                    onClick={() => void onRefreshModels()}
                    disabled={isRefreshingModels}
                    title={modelCopy.refresh}
                    aria-label={modelCopy.refresh}
                    aria-busy={isRefreshingModels}
                  >
                    <RefreshCw
                      size={16}
                      style={{
                        color: "var(--tab-text, #162032)",
                        animation: isRefreshingModels
                          ? "spin 0.9s linear infinite"
                          : undefined,
                      }}
                    />
                  </button>
                </div>
              </div>

              <div style={{ ...commonStyles.settingsActions, flexShrink: 0 }}>
                <button
                  type="button"
                  style={{ ...commonStyles.resetButton, padding: "6px 12px", flexShrink: 0 }}
                  onClick={onReset}
                  title={modelCopy.reset}
                  aria-label={modelCopy.reset}
                >
                  <RefreshCw size={18} />
                  <span>
                    {language === "es" ? "Reiniciar" : "Reset"}
                  </span>
                </button>
              </div>
            </div>

            {(executionStatus ||
              (queueInfo && (queueInfo.offline || queueInfo.pending > 0))) && (
              <div style={commonStyles.settingsInfoRow}>
                {executionStatus?.message && (
                  <span
                    style={{
                      ...commonStyles.settingsHint,
                      color: "#fef08a",
                      textAlign: "right",
                    }}
                  >
                    {executionStatus.message}
                  </span>
                )}
                {queueInfo && (queueInfo.offline || queueInfo.pending > 0) && (
                  <button
                    type="button"
                    style={{
                      ...commonStyles.resetButton,
                      padding: "4px 10px",
                      fontSize: "0.8em",
                      marginLeft: "auto",
                    }}
                    onClick={queueInfo.onRetry}
                  >
                    {queueInfo.offline
                      ? language === "es"
                        ? `Offline (${queueInfo.pending} en cola)`
                        : `Offline (${queueInfo.pending} queued)`
                      : language === "es"
                      ? `En cola: ${queueInfo.pending}`
                      : `Queued: ${queueInfo.pending}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main style={commonStyles.mainContent}>
        <nav style={commonStyles.tabNavigation} role="tablist">
          {tabs.map((tab) => {
            const modeInfo = modeAvailability?.[tab.id];
            const disabled = modeInfo?.enabled === false;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeMode === tab.id}
                aria-pressed={activeMode === tab.id}
                style={{
                  ...commonStyles.tabButton,
                  ...(activeMode === tab.id ? commonStyles.tabButtonActive : {}),
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
                disabled={disabled}
                title={
                  disabled
                    ? modeInfo?.reason ||
                      (language === "es"
                        ? "Requiere más recursos."
                        : "Not available for this hardware.")
                    : undefined
                }
                onClick={() => {
                  if (!disabled) {
                    onTabChange(tab.id);
                  }
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div style={commonStyles.modeScrollArea}>{children}</div>
      </main>

      {help.isOpen && (
        <div
          style={commonStyles.helpOverlay}
          role="presentation"
          onClick={help.onClose}
        >
          <div
            style={commonStyles.helpModal}
            role="dialog"
            aria-modal="true"
            aria-label={help.title}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={commonStyles.helpModalHeader}>
              <h2 style={{ margin: 0 }}>{help.title}</h2>
              <button
                type="button"
                style={commonStyles.helpCloseButton}
                onClick={help.onClose}
                aria-label={help.closeLabel}
                title={help.closeLabel}
              >
                ×
              </button>
            </div>
            <p style={commonStyles.helpIntro}>{help.description}</p>
            <ul style={commonStyles.helpModalList}>
              {help.tips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
