import { usePreferences } from "@/i18n";
import { splitLines } from "@/lib/aulaForm";
export default function useRecipeReview({
  form,
  selected,
  recipes,
  hasCustom,
  port,
  notify,
  setMessage,
  setPending,
  setStep,
  setConfirmation,
}) {
  const { t } = usePreferences();
  const hasSelection = selected.length > 0;
  function nextParameters() {
    if (!recipes.length)
      return notify(t("Selecciona al menos una receta."), true);
    if (
      recipes.includes("delete_user") &&
      recipes.some((id) => !["check", "delete_user"].includes(id))
    )
      return notify(
        t(
          "Ejecuta la eliminación por separado de las recetas de configuración.",
        ),
        true,
      );
    setPending(null);
    setMessage(null);
    setStep(1);
  }
  function review() {
    try {
      if (!hasSelection) throw Error(t("Selecciona al menos un equipo."));
      if (!form.ssh_user.trim()) throw Error(t("Introduce el usuario SSH."));
      if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(form.ssh_user.trim()))
        throw Error(t("Usuario SSH inválido", "Usuari SSH invàlid"));
      if (recipes.includes("user") && !form.target_password)
        throw Error(t("Introduce la contraseña del usuario que vas a crear."));
      if (recipes.includes("delete_user") && !form.delete_username.trim())
        throw Error(t("Introduce el username que quieres eliminar."));
      if (recipes.includes("folders") && !splitLines(form.folders).length)
        throw Error(t("Introduce al menos una carpeta de origen."));
      if (
        (recipes.includes("java") || hasCustom) &&
        (!/^\d{1,2}$/.test(form.jdk) || +form.jdk < 8 || +form.jdk > 99)
      )
        throw Error(t("Indica una versión OpenJDK entre 8 y 99."));
      if (
        recipes.some((id) => ["user", "vscode", "folders"].includes(id)) &&
        !/^[a-z_][a-z0-9_-]{0,31}$/.test(form.target_user.trim())
      )
        throw Error(t("Usuario del aula inválido", "Usuari de l’aula invàlid"));
      let settings = {};
      if (recipes.includes("vscode") || hasCustom) {
        try {
          settings = JSON.parse(form.settings);
        } catch {
          throw Error(
            t(
              "settings.json debe contener JSON válido.",
              "settings.json ha de contindre JSON vàlid.",
            ),
          );
        }
        if (
          !settings ||
          Array.isArray(settings) ||
          typeof settings !== "object"
        )
          throw Error(
            t(
              "settings.json debe contener un objeto JSON.",
              "settings.json ha de contindre un objecte JSON.",
            ),
          );
      }
      setPending({
        ssh_password: form.ssh_password,
        sudo_password: form.sudo_password,
        target_password: recipes.includes("user") ? form.target_password : "",
        reset_password: form.reset_password,
        delete_home: form.delete_home,
        jdk: recipes.includes("java") || hasCustom ? form.jdk : "21",
        hosts: [...selected],
        recipes: [...recipes],
        port: port(),
        ssh_user: form.ssh_user.trim(),
        target_user:
          recipes.some((id) => ["user", "vscode", "folders"].includes(id)) ||
          hasCustom
            ? form.target_user.trim()
            : "",
        delete_username: form.delete_username.trim(),
        private_key: form.private_key.trim(),
        extensions:
          recipes.includes("vscode") || hasCustom
            ? splitLines(form.extensions)
            : [],
        folders:
          recipes.includes("folders") || hasCustom
            ? splitLines(form.folders)
            : [],
        settings,
      });
      setConfirmation("");
      setStep(2);
      setMessage(null);
    } catch (error) {
      notify(error.message, true);
    }
  }

  return { nextParameters, review };
}
