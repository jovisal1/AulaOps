import { usePreferences } from "@/i18n";
import { splitLines } from "@/lib/aulaForm";
export default function useRecipeReview({
  form,
  selected,
  recipes,
  hasCustom,
  requiresTargetUser,
  accountRecipes,
  shutdownRecipes,
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
    if (
      recipes.includes("user") &&
      accountRecipes.some(
        (id) =>
          recipes.includes(id) && recipes.indexOf(id) < recipes.indexOf("user"),
      )
    )
      return notify(
        t(
          "Coloca Crear usuario del aula antes de VS Code y de la copia al escritorio.",
          "Col·loca Crear usuari de l’aula abans de VS Code i de la còpia a l’escriptori.",
        ),
        true,
      );
    if (
      shutdownRecipes.some(
        (id) =>
          recipes.includes(id) && recipes.indexOf(id) !== recipes.length - 1,
      )
    )
      return notify(
        t(
          "Coloca Apagar PCs del aula al final del orden de ejecución.",
          "Col·loca Apagar PCs de l’aula al final de l’ordre d’execució.",
        ),
        true,
      );
    setPending(null);
    setMessage(null);
    setStep(1);
  }
  async function review() {
    try {
      if (!hasSelection) throw Error(t("Selecciona al menos un equipo."));
      if (recipes.includes("user") && !form.target_password)
        throw Error(t("Introduce la contraseña del usuario que vas a crear."));
      if (recipes.includes("delete_user") && !form.delete_username.trim())
        throw Error(t("Introduce el username que quieres eliminar."));
      if (
        recipes.includes("folders") &&
        !splitLines(form.folders).length &&
        !form.files.length
      )
        throw Error(t("Introduce al menos una carpeta de origen."));
      if (
        (recipes.includes("java") || hasCustom) &&
        (!/^\d{1,2}$/.test(form.jdk) || +form.jdk < 8 || +form.jdk > 99)
      )
        throw Error(t("Indica una versión OpenJDK entre 8 y 99."));
      if (
        requiresTargetUser &&
        !/^[A-Za-z_][A-Za-z0-9_-]{0,31}$/.test(form.target_user.trim())
      )
        throw Error(
          t("Usuario del aula inválido", "Usuari de l’aula invàlid") +
            ": " +
            JSON.stringify(form.target_user) +
            ". " +
            t(
              "Usa entre 1 y 32 caracteres: letras mayúsculas o minúsculas, números, _ o -; empieza por letra o _.",
              "Usa entre 1 i 32 caràcters: lletres majúscules o minúscules, números, _ o -; comença per lletra o _.",
            ),
        );
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
      let files = [];
      if (recipes.includes("folders")) {
        if (form.files.length && !form.destination_folder.trim())
          throw Error(
            t(
              "Introduce el nombre de la carpeta de destino en el escritorio.",
              "Introduïx el nom de la carpeta de destinació en l’escriptori.",
            ),
          );
        if (
          form.files.length > 50 ||
          form.files.reduce((sum, file) => sum + file.size, 0) >
            20 * 1024 * 1024
        )
          throw Error(
            t(
              "Selecciona como máximo 50 archivos y 20 MiB en total.",
              "Selecciona com a màxim 50 fitxers i 20 MiB en total.",
            ),
          );
        files = await Promise.all(
          form.files.map(
            (file) =>
              new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () =>
                  resolve({
                    name: file.name,
                    content: reader.result.split(",")[1],
                  });
                reader.onerror = () =>
                  reject(
                    Error(
                      t(
                        "No se pudo leer el archivo.",
                        "No s’ha pogut llegir el fitxer.",
                      ),
                    ),
                  );
                reader.readAsDataURL(file);
              }),
          ),
        );
      }
      const connectionOnly = recipes.length === 1 && recipes[0] === "check";
      setPending({
        files,
        destination_folder: form.destination_folder.trim(),
        ssh_password: form.ssh_password,
        sudo_password: connectionOnly ? form.ssh_password : form.sudo_password,
        target_password: recipes.includes("user") ? form.target_password : "",
        reset_password: form.reset_password,
        user_sudo: form.user_sudo,
        delete_home: form.delete_home,
        jdk: recipes.includes("java") || hasCustom ? form.jdk : "21",
        hosts: [...selected],
        recipes: [...recipes],
        port: port(),
        ssh_user: form.ssh_user.trim(),
        target_user: requiresTargetUser ? form.target_user.trim() : "",
        delete_username: form.delete_username.trim(),
        private_key: connectionOnly ? "" : form.private_key.trim(),
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
