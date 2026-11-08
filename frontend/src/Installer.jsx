import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Download,
  Loader2,
  PackageCheck,
  Terminal,
} from "lucide-react";
import Shell from "./components/Shell";
import { Field } from "./components/Fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { usePreferences } from "./i18n";
import { request } from "./lib/api";
export default function Installer() {
  const { t } = usePreferences();
  const [state, setState] = useState(null),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let stopped = false,
      timer;
    const controller = new AbortController();
    async function poll() {
      try {
        const data = await request("/status", undefined, controller.signal);
        if (stopped) return;
        setState(data);
        timer = setTimeout(poll, data.status === "installing" ? 1500 : 5000);
      } catch (e) {
        if (stopped) return;
        setError(t("No se pudo consultar el estado; reintentando."));
        timer = setTimeout(poll, 3000);
      }
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
  const installing = state?.status === "installing";
  async function install() {
    setBusy(true);
    setError("");
    try {
      await request("/install", { password });
      setPassword("");
      setState((current) => ({ ...current, status: "installing", log: [] }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function open() {
    setBusy(true);
    setError("");
    try {
      const data = await request("/open", {});
      window.location.assign(data.url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell installer>
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PackageCheck className="size-6" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              {t("Preparación de Aula Ansible", "Preparació d’Aula Ansible")}
            </CardTitle>
            <Badge variant="secondary">
              {t(
                !state
                  ? "Comprobando…"
                  : installing
                    ? "Instalando…"
                    : state.ready
                      ? "Preparada"
                      : "Pendiente",
                !state
                  ? "Comprovant…"
                  : installing
                    ? "Instal·lant…"
                    : state.ready
                      ? "Preparada"
                      : "Pendent",
              )}
            </Badge>
          </div>
          <CardDescription>
            {t(
              "El asistente comprueba Python, SSH y Ansible en este equipo.",
              "L’assistent comprova Python, SSH i Ansible en este equip.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!state ? (
            <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("Comprobando dependencias…", "Comprovant dependències…")}
            </div>
          ) : (
            <>
              {state.ready ? (
                <Alert>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <AlertDescription>
                    {t(
                      "Las dependencias están preparadas. Ya puedes abrir la aplicación.",
                      "Les dependències estan preparades. Ja pots obrir l’aplicació.",
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="rounded-xl border bg-muted/30 p-5">
                    <p className="mb-3 text-sm font-medium">
                      {t("Dependencias pendientes", "Dependències pendents")}
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {state.missing?.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                          {t(item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t(
                      "Se instalarán python3-venv, openssh-client, sshpass e iproute2, y se preparará el entorno virtual con Ansible. Mantén esta ventana y la terminal abiertas.",
                      "S’instal·laran python3-venv, openssh-client, sshpass i iproute2, i es prepararà l’entorn virtual amb Ansible. Mantín esta finestra i la terminal obertes.",
                    )}
                  </p>
                  <Field
                    id="install_password"
                    label={t(
                      "Contraseña sudo de este equipo (opcional)",
                      "Contrasenya sudo d’este equip (opcional)",
                    )}
                    value={password}
                    onChange={setPassword}
                    type="password"
                    autoComplete="off"
                    disabled={installing || busy}
                    help={t(
                      "Déjala vacía si sudo no requiere contraseña. No se guarda.",
                      "Deixa-la buida si sudo no requerix contrasenya. No es guarda.",
                    )}
                  />
                </>
              )}
              {installing && (
                <Alert>
                  <Loader2 className="size-4 animate-spin" />
                  <AlertDescription>
                    {t(
                      "Instalación en curso. Puedes consultar el progreso en el registro.",
                      "Instal·lació en curs. Pots consultar el progrés en el registre.",
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {!!state.log?.length && (
                <Accordion type="single" collapsible defaultValue="log">
                  <AccordionItem value="log">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2">
                        <Terminal className="size-4" />
                        {t(
                          "Registro de instalación",
                          "Registre d’instal·lació",
                        )}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-4 font-mono text-xs leading-6">
                        {state.log.map((line) => t(line)).join("\n")}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
              {(error || state.error) && (
                <Alert variant="destructive">
                  <CircleAlert className="size-4" />
                  <AlertDescription>{t(error || state.error)}</AlertDescription>
                </Alert>
              )}
              <div className="flex justify-end border-t pt-5">
                {state.ready ? (
                  <Button onClick={open} disabled={busy || installing}>
                    {busy ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <ArrowRight />
                    )}
                    {t("Abrir aplicación", "Obrir aplicació")}
                  </Button>
                ) : (
                  <Button onClick={install} disabled={busy || installing}>
                    {busy || installing ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Download />
                    )}
                    {t("Instalar y preparar", "Instal·lar i preparar")}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </Shell>
  );
}
