import {
  ArrowRight,
  CircleAlert,
  ClipboardList,
  KeyRound,
  Loader2,
  Server,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePreferences } from "@/i18n";
import { useAulaContext } from "@/hooks/AulaContext";
export default function OverviewPanel() {
  const { t } = usePreferences();
  const {
    hosts,
    inventory,
    inventoryError,
    hasSelection,
    go,
    recipes,
    status,
  } = useAulaContext();
  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/25 pb-6">
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl border bg-background">
            <Server className="size-5 text-primary" />
          </div>
          <CardTitle>{t("Resumen del aula")}</CardTitle>
          <CardDescription>
            {t(
              "Tu inventario, preparado para la siguiente sesión.",
              "El teu inventari, preparat per a la pròxima sessió.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {inventoryError ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>
                {t(
                  "No se pudo leer hosts.yml:",
                  "No s’ha pogut llegir hosts.yml:",
                )}{" "}
                {t(inventoryError)}
              </AlertDescription>
            </Alert>
          ) : !inventory ? (
            <div
              role="status"
              className="flex items-center gap-3 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              {t("Comprobando si existe hosts.yml…")}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-medium">
                  {t(
                    inventory.exists
                      ? "Inventario guardado · hosts.yml"
                      : "No hay un hosts.yml guardado",
                  )}
                </h2>
                {inventory.exists && <Badge variant="secondary">YAML</Badge>}
              </div>
              {inventory.exists ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-muted/60 p-5">
                      <div className="text-3xl font-semibold tracking-tight">
                        {inventory.hosts.length}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("Equipos")}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/60 p-5">
                      <div className="font-mono text-3xl font-semibold tracking-tight">
                        {inventory.port}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("Puerto SSH")}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t(
                      "Puedes continuar sin volver a descubrir ni guardar los equipos.",
                      "Pots continuar sense tornar a descobrir ni guardar els equips.",
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {inventory.hosts.slice(0, 8).map((ip) => (
                      <Badge
                        key={ip}
                        variant="outline"
                        className="font-mono font-normal"
                      >
                        {ip}
                      </Badge>
                    ))}
                    {inventory.hosts.length > 8 && (
                      <Badge variant="secondary">
                        +{inventory.hosts.length - 8}
                      </Badge>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  {t(
                    "Empieza por el apartado Equipos para descubrir o añadir las direcciones del aula.",
                  )}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {inventory.hosts.length > 0 && (
                  <Button
                    id="continue_inventory"
                    disabled={!hasSelection}
                    onClick={() => go("recipes")}
                  >
                    {t("Continuar con este inventario")}
                    <ArrowRight />
                  </Button>
                )}
                <Button
                  variant={inventory.hosts.length ? "outline" : "default"}
                  onClick={() => go("equipment")}
                >
                  {t("Configurar equipos")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">
            {t("De la receta al resultado", "De la recepta al resultat")}
          </CardTitle>
          <CardDescription>
            {t(
              "Un proceso guiado, paso a paso.",
              "Un procés guiat, pas a pas.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {[
            [
              ClipboardList,
              "Selecciona las recetas",
              "Elige las tareas que necesitas.",
              "Tria les tasques que necessites.",
            ],
            [
              KeyRound,
              "Parámetros de las recetas",
              "Completa solo lo necesario.",
              "Completa només el que cal.",
            ],
            [
              Terminal,
              "Ejecutar y ver logs",
              "Sigue el resultado de cada equipo.",
              "Seguix el resultat de cada equip.",
            ],
          ].map(([Icon, title, es, ca], i) => (
            <div key={title} className="flex gap-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {String(i + 1).padStart(2, "0")}{" "}
                  <span className="ml-2">
                    {t(
                      title,
                      title === "Ejecutar y ver logs"
                        ? "Executar i vore logs"
                        : undefined,
                    )}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t(es, ca)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
