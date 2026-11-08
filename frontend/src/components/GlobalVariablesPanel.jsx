import {
  FileCode2,
  Loader2,
  Save,
  RefreshCw,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "./Fields";
import { useAulaContext } from "@/hooks/AulaContext";
import { usePreferences } from "@/i18n";
export default function GlobalVariablesPanel() {
  const { t } = usePreferences();
  const {
    globalContent,
    setGlobalContent,
    globalError,
    globalsLoading,
    globalsSaving,
    globalsSaved,
    saveGlobals,
    reloadGlobals,
  } = useAulaContext();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode2 className="size-5 text-primary" />
          {t("Variables globales", "Variables globals")}
        </CardTitle>
        <CardDescription>
          {t(
            "Valores compartidos por los playbooks. Puedes ajustarlos en cada ejecución desde el asistente.",
            "Valors compartits pels playbooks. Pots ajustar-los en cada execució des de l’assistent.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <FileCode2 className="size-4" />
          <AlertDescription>
            {t(
              "Se guardan en data/global_vars.yml. Los parámetros de la ejecución tienen prioridad. Las credenciales SSH y sudo se introducen en el asistente.",
              "Es guarden en data/global_vars.yml. Els paràmetres de l’execució tenen prioritat. Les credencials SSH i sudo s’introduïxen en l’assistent.",
            )}
          </AlertDescription>
        </Alert>
        {globalsLoading ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" />
            {t("Cargando variables…", "Carregant variables…")}
          </p>
        ) : globalContent ? (
          <Field
            id="global_variables"
            label={t("Variables globales (YAML)", "Variables globals (YAML)")}
            value={globalContent}
            onChange={setGlobalContent}
            multiline
            rows={18}
            className="font-mono text-xs"
            disabled={globalsSaving}
            help={t(
              "Configura aula_user, aula_jdk, aula_extensions, aula_settings y aula_folders. También puedes añadir variables propias para tus recetas.",
              "Configura aula_user, aula_jdk, aula_extensions, aula_settings i aula_folders. També pots afegir variables pròpies per a les teues receptes.",
            )}
          />
        ) : null}
        {globalError && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertDescription>{t(globalError)}</AlertDescription>
          </Alert>
        )}
        {globalsSaved && (
          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertDescription>
              {t(
                "Variables guardadas y aplicadas como valores predeterminados.",
                "Variables guardades i aplicades com a valors predeterminats.",
              )}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
          <Button
            variant="outline"
            disabled={globalsLoading || globalsSaving}
            onClick={() => reloadGlobals()}
          >
            <RefreshCw />
            {t("Recargar variables", "Recarregar variables")}
          </Button>
          <Button
            id="save_globals"
            disabled={globalsLoading || globalsSaving || !globalContent.trim()}
            onClick={saveGlobals}
          >
            {globalsSaving ? <Loader2 className="animate-spin" /> : <Save />}
            {t("Guardar variables", "Guardar variables")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
