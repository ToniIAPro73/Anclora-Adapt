import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ModelProvider } from "@/context/ModelContext";
import { UIProvider } from "@/context/UIContext";
import { MediaProvider } from "@/context/MediaContext";
import { InteractionProvider } from "@/context/InteractionContext";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ModelProvider>
          <UIProvider>
            <MediaProvider>
              <InteractionProvider>
                <App />
              </InteractionProvider>
            </MediaProvider>
          </UIProvider>
        </ModelProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
