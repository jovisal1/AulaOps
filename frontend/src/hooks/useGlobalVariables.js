import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
export default function useGlobalVariables(onApply) {
  const [globalContent, setGlobalContent] = useState(""),
    [globalError, setGlobalError] = useState(""),
    [globalsLoading, setGlobalsLoading] = useState(true),
    [globalsSaving, setGlobalsSaving] = useState(false),
    [globalsSaved, setGlobalsSaved] = useState(false);
  const apply = useRef(onApply);
  apply.current = onApply;
  async function reloadGlobals(initial = false) {
    setGlobalsLoading(true);
    setGlobalError("");
    setGlobalsSaved(false);
    try {
      const data = await api("globals");
      setGlobalContent(data.content);
      apply.current(data.variables, initial);
    } catch (error) {
      setGlobalError(
        error.status === 404
          ? "El servidor está desactualizado. Reinicia Aula Ansible y pulsa Recargar variables."
          : error.message,
      );
    } finally {
      setGlobalsLoading(false);
    }
  }
  useEffect(() => {
    reloadGlobals(true);
  }, []);
  async function saveGlobals() {
    if (globalsSaving) return;
    setGlobalsSaving(true);
    setGlobalError("");
    setGlobalsSaved(false);
    try {
      const data = await api("globals", { content: globalContent });
      setGlobalContent(data.content);
      apply.current(data.variables, false);
      setGlobalsSaved(true);
    } catch (error) {
      setGlobalError(
        error.status === 404
          ? "El servidor está desactualizado. Reinicia Aula Ansible y pulsa Recargar variables."
          : error.message,
      );
    } finally {
      setGlobalsSaving(false);
    }
  }
  return {
    globalContent,
    setGlobalContent: (content) => {
      setGlobalContent(content);
      setGlobalsSaved(false);
    },
    globalError,
    globalsLoading,
    globalsSaving,
    globalsSaved,
    saveGlobals,
    reloadGlobals,
  };
}
