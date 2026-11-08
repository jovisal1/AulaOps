import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  Plus,
  Download,
  Square,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckField } from "./Fields";
import { usePreferences } from "@/i18n";
import { useAulaContext } from "@/hooks/AulaContext";
import { api } from "@/lib/api";
import JobLogs from "./JobLogs";
export default function ExecutionPanel() {
  const { t } = usePreferences();
  const {
    hosts,
    busy,
    go,
    setStep,
    active,
    recipes,
    jobId,
    job,
    groups,
    status,
    statusText,
    pollError,
    ipFilter,
    setIpFilter,
    errorsOnly,
    setErrorsOnly,
    setConfirmAction,
    task,
    notify,
    download,
  } = useAulaContext();
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{t("Logs de ejecución", "Logs d’execució")}</CardTitle>
            <CardDescription className="mt-2">
              {t(
                "Cada tarea y cada equipo, en un mismo lugar.",
                "Cada tasca i cada equip, en un mateix lloc.",
              )}
            </CardDescription>
          </div>
          <Badge
            variant={status === "failed" ? "destructive" : "secondary"}
            className="gap-2 px-3 py-1.5"
          >
            {status === "running" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : status === "successful" ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <CircleAlert className="size-3.5" />
            )}
            <span id="status">{statusText}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [job?.hosts.length || 0, t("Equipos")],
            [
              groups.filter((g) => g.events.length && !g.failed).length,
              t("Con resultados", "Amb resultats"),
            ],
            [groups.filter((g) => g.failed).length, t("Con errores")],
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl border bg-muted/20 p-4">
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        {status === "running" && (
          <Progress
            aria-label={t("Equipos con resultados", "Equips amb resultats")}
            value={
              groups.length
                ? (groups.filter((g) => g.events.length).length /
                    groups.length) *
                  100
                : 0
            }
          />
        )}
        {pollError && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertDescription>
              {t("No se pudo consultar el estado; reintentando.")}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-end gap-5">
          <div className="w-full space-y-2 sm:w-64">
            <Label htmlFor="log_ip">{t("Filtrar por IP")}</Label>
            <Select value={ipFilter} onValueChange={setIpFilter}>
              <SelectTrigger id="log_ip" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("Todos los equipos")}</SelectItem>
                {job?.hosts.map((ip) => (
                  <SelectItem key={ip} value={ip}>
                    {ip}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pb-2">
            <CheckField
              id="errors_only"
              checked={errorsOnly}
              onChange={setErrorsOnly}
            >
              {t("Solo equipos con errores")}
            </CheckField>
          </div>
        </div>
        <div id="log" className="space-y-4">
          {!job && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-xl border p-8 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              {t("Esperando resultados…")}
            </div>
          )}
          {job && (
            <JobLogs
              groups={groups.filter(
                (g) =>
                  (ipFilter === "all" || ipFilter === g.ip) &&
                  (!errorsOnly || g.failed),
              )}
              status={status}
            />
          )}
          {job?.diagnostic && (
            <Alert variant="destructive">
              <CircleAlert className="size-4" />
              <AlertTitle>
                {t(
                  "Diagnóstico general de Ansible",
                  "Diagnòstic general d’Ansible",
                )}
              </AlertTitle>
              <AlertDescription>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">
                  {job.diagnostic}
                </pre>
              </AlertDescription>
            </Alert>
          )}
        </div>
        {job?.error && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertDescription>{t(job.error)}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
          <div className="flex flex-wrap gap-2">
            <Button
              id="cancel"
              variant="outline"
              disabled={!active || !!busy}
              onClick={() =>
                setConfirmAction({
                  title: t("Cancelar ejecución"),
                  description: t(
                    "¿Solicitar la cancelación? Los cambios ya aplicados se conservarán.",
                  ),
                  run: () =>
                    task("cancel", async () => {
                      await api("cancel/" + jobId, {});
                      notify(
                        t(
                          "Cancelación solicitada. Puede tardar unos segundos.",
                        ),
                      );
                    }),
                })
              }
            >
              <Square />
              {t("Cancelar ejecución")}
            </Button>
            <Button
              id="download"
              variant="outline"
              disabled={!job}
              onClick={download}
            >
              <Download />
              {t("Descargar resumen")}
            </Button>
          </div>
          <Button
            id="new_execution"
            disabled={active}
            onClick={() => {
              setStep(0);
              go("recipes");
            }}
          >
            <Plus />
            {t("Preparar otra ejecución")}
          </Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {t(
            "Despliega cada IP para ver tareas, errores, stdout, stderr y códigos de salida. Se ocultan las credenciales conocidas y la salida marcada no_log; evita imprimir otros secretos en recetas personalizadas. El historial de esta sesión permanece en memoria.",
          )}
        </p>
      </CardContent>
    </Card>
  );
}
