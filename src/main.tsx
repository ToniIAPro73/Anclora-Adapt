import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { InteractionProvider } from "@/context/InteractionContext";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <InteractionProvider>
          <App />
        </InteractionProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
