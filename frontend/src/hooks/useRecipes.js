import { useEffect, useState } from "react";
import { usePreferences } from "@/i18n";
import { api } from "@/lib/api";
import { builtins } from "@/lib/recipes";
export default function useRecipes({ busy, setBusy, notify }) {
  const { t } = usePreferences();
  const [recipes, setRecipes] = useState(["check"]),
    [custom, setCustom] = useState([]),
    [recipeOpen, setRecipeOpen] = useState(false);
  const [draft, setDraft] = useState({
      name: "",
      description: "",
      content:
        "- name: Instalar Git\n  ansible.builtin.apt:\n    name: git\n    state: present\n    update_cache: true\n    cache_valid_time: 3600",
    }),
    [recipeError, setRecipeError] = useState(""),
    [recipeFilename, setRecipeFilename] = useState("");
  const name = (id) =>
    builtins.find((r) => r[0] === id)?.[1] ||
    custom.find((r) => r.id === id)?.name ||
    id;
  const recipeName = (id) =>
    builtins.some((r) => r[0] === id) ? t(name(id)) : name(id);

  useEffect(() => {
    const controller = new AbortController();
    api("recipes", undefined, controller.signal)
      .then((data) => setCustom(data.recipes))
      .catch((error) => {
        if (error.name !== "AbortError") notify(error.message, true);
      });
    return () => controller.abort();
  }, []);
  async function saveRecipe() {
    if (!draft.name.trim())
      return setRecipeError(
        t("Indica el nombre de la receta", "Indica el nom de la recepta"),
      );
    if (busy) return;
    setBusy("recipe");
    setRecipeError("");
    try {
      const data = await api("recipes", {
        ...draft,
        name: draft.name.trim(),
        description: draft.description.trim(),
      });
      setCustom((current) => [...current, data]);
      setDraft((current) => ({ ...current, name: "", description: "" }));
      setRecipeOpen(false);
      notify(t("Nueva receta añadida sin ejecutarla."));
    } catch (error) {
      setRecipeError(error.message);
    } finally {
      setBusy("");
    }
  }

  return {
    recipes,
    setRecipes,
    custom,
    recipeOpen,
    setRecipeOpen,
    draft,
    setDraft,
    recipeError,
    setRecipeError,
    recipeFilename,
    setRecipeFilename,
    recipeName,
    saveRecipe,
    hasCustom: recipes.some(
      (id) =>
        id.startsWith("custom_") &&
        !custom.find((recipe) => recipe.id === id)?.bundled,
    ),
    requiresTargetUser: recipes.some(
      (id) =>
        ["user", "vscode", "folders"].includes(id) ||
        (id.startsWith("custom_") &&
          (!custom.find((recipe) => recipe.id === id)?.bundled ||
            custom.find((recipe) => recipe.id === id)?.requires_account)),
    ),
    accountRecipes: [
      "vscode",
      "folders",
      ...custom
        .filter((recipe) => recipe.requires_account)
        .map((recipe) => recipe.id),
    ],
    shutdownRecipes: custom
      .filter((recipe) => recipe.shutdown)
      .map((recipe) => recipe.id),
  };
}
