import React from "react";
import { createRoot } from "react-dom/client";
import { PreferencesProvider } from "./i18n";
import App from "./App";
import Installer from "./Installer";
import "./index.css";
const installer =
  document.querySelector('meta[name="aula-mode"]')?.content === "installer";
createRoot(document.getElementById("root")).render(
  <PreferencesProvider>
    {installer ? <Installer /> : <App />}
  </PreferencesProvider>,
);
