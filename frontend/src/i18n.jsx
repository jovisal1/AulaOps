import { createContext, useContext, useEffect, useState } from "react";
import dictionary from "./translations.json";
const Context = createContext(null);
function stored(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
export function PreferencesProvider({ children }) {
  const [language, setLanguage] = useState(() =>
    stored("aula-language", "es") === "ca" ? "ca" : "es",
  );
  const [theme, setTheme] = useState(() =>
    stored(
      "aula-theme",
      matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    ) === "dark"
      ? "dark"
      : "light",
  );
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem("aula-language", language);
    } catch {}
  }, [language]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("aula-theme", theme);
    } catch {}
  }, [theme]);
  const t = (es, ca) => {
    if (language !== "ca") return es;
    if (ca || dictionary[es]) return ca || dictionary[es];
    // Traduce solo las cabeceras propias; conserva los diagnósticos y datos originales.
    const prefixes = [
      [
        "Nombre de variable global no permitido: ",
        "Nom de variable global no permés: ",
      ],
      ["Ansible no acepta esta receta: ", "Ansible no accepta esta recepta: "],
      ["Usuario inválido: ", "Usuari invàlid: "],
      [
        "Carpeta de origen inválida o inexistente: ",
        "Carpeta d’origen invàlida o inexistent: ",
      ],
      [
        "La instalación terminó pero faltan: ",
        "La instal·lació ha acabat però falten: ",
      ],
    ];
    const prefix = prefixes.find(([from]) => es?.startsWith(from));
    return prefix ? prefix[1] + es.slice(prefix[0].length) : es;
  };
  return (
    <Context.Provider value={{ language, setLanguage, theme, setTheme, t }}>
      {children}
    </Context.Provider>
  );
}
export const usePreferences = () => useContext(Context);
