import { Check, CircleAlert, FileCode2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "./Fields";
import { usePreferences } from "@/i18n";
import { useAulaContext } from "@/hooks/AulaContext";
export default function RecipeDialog() {
  const { t } = usePreferences();
  const {
    hosts,
    busy,
    recipeOpen,
    setRecipeOpen,
    draft,
    setDraft,
    recipeError,
    setRecipeError,
    recipeFilename,
    setRecipeFilename,
    saveRecipe,
  } = useAulaContext();
  return (
    <Dialog
      open={recipeOpen}
      onOpenChange={(open) => {
        if (busy !== "recipe") setRecipeOpen(open);
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("open_recipe")?.focus();
        }}
        closeLabel={t("Cerrar")}
        className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{t("Añadir nueva receta")}</DialogTitle>
          <DialogDescription>
            {t(
              "Crea una receta o importa sus tareas desde un archivo YAML.",
              "Crea una recepta o importa les tasques des d’un fitxer YAML.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <Alert>
            <FileCode2 className="size-4" />
            <AlertDescription>
              {t(
                "Las recetas son código Ansible y se ejecutan con tu acceso SSH y sudo. Añade solo tareas que hayas revisado. No incluyas contraseñas en el YAML.",
              )}
            </AlertDescription>
          </Alert>
          <Field
            id="recipe_name"
            label={t("Nombre de la receta")}
            value={draft.name}
            onChange={(name) => setDraft((current) => ({ ...current, name }))}
            maxLength={80}
            placeholder={t("Instalar Git")}
          />
          <Field
            id="recipe_description"
            label={t("Descripción (opcional)")}
            value={draft.description}
            onChange={(description) =>
              setDraft((current) => ({ ...current, description }))
            }
            maxLength={300}
          />
          <Field
            id="recipe_file"
            className="sr-only"
            tabIndex={-1}
            label={t("Importar tareas desde un archivo .yml o .yaml")}
            type="file"
            accept=".yml,.yaml,text/yaml"
            value={undefined}
            onChange={() => {}}
            onInput={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 65536)
                return setRecipeError(t("El archivo supera 64 KiB."));
              try {
                const content = await file.text();
                setRecipeFilename(file.name);
                setDraft((current) => ({
                  ...current,
                  content,
                  name: current.name || file.name.replace(/\.ya?ml$/i, ""),
                }));
                setRecipeError("");
              } catch {
                setRecipeError(
                  t(
                    "No se pudo leer el archivo",
                    "No s’ha pogut llegir el fitxer",
                  ),
                );
              }
            }}
          />
          <div className="-mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy === "recipe"}
              onClick={() => document.getElementById("recipe_file")?.click()}
            >
              <FileText />
              {t("Seleccionar archivo", "Seleccionar fitxer")}
            </Button>
            <span
              className="max-w-full break-all text-xs text-muted-foreground"
              aria-live="polite"
            >
              {recipeFilename ||
                t("Ningún archivo seleccionado", "Cap fitxer seleccionat")}
            </span>
          </div>
          <Field
            id="recipe_yaml"
            multiline
            rows={9}
            className="font-mono text-xs"
            label={t("Tareas de Ansible (YAML editable)")}
            value={draft.content}
            onChange={(content) =>
              setDraft((current) => ({ ...current, content }))
            }
          />
          <p className="text-xs leading-5 text-muted-foreground">
            {t(
              "Introduce una lista de tareas, sin la cabecera hosts/tasks de un playbook. Los destinos y sudo los gestiona la aplicación. Puedes usar aula_user, aula_jdk y las demás variables del formulario. Los roles, colecciones y archivos externos deben instalarse previamente en el equipo de control.",
            )}
          </p>
          {recipeError && (
            <Alert variant="destructive">
              <CircleAlert className="size-4" />
              <AlertDescription>{t(recipeError)}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy === "recipe"}>
              {t("Volver")}
            </Button>
          </DialogClose>
          <Button id="save_recipe" disabled={!!busy} onClick={saveRecipe}>
            {busy === "recipe" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Check />
            )}
            {t(
              busy === "recipe"
                ? "Comprobando sintaxis con Ansible…"
                : "Validar y guardar receta",
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
