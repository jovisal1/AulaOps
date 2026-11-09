import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { usePreferences } from "@/i18n";
export default function JobLogs({ groups, status }) {
  const { t } = usePreferences();
  const [open, setOpen] = useState([]);
  const seen = useRef(new Set());
  useEffect(() => {
    const newlyFailed = groups
      .filter((g) => g.failed && !seen.current.has(g.ip))
      .map((g) => g.ip);
    groups.forEach((g) => {
      if (g.failed) seen.current.add(g.ip);
    });
    if (newlyFailed.length)
      setOpen((current) => [...new Set([...current, ...newlyFailed])]);
  }, [groups]);
  if (!groups.length)
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("No hay equipos que coincidan con los filtros.")}
      </p>
    );
  return (
    <Accordion
      type="multiple"
      value={open}
      onValueChange={setOpen}
      className="space-y-3"
    >
      {groups.map((group) => (
        <AccordionItem
          key={group.ip}
          value={group.ip}
          className={
            "overflow-hidden rounded-xl border px-4 " +
            (group.failed ? "border-destructive/40" : "")
          }
        >
          <AccordionTrigger className="gap-3 hover:no-underline">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={
                  "size-2 rounded-full " +
                  (group.failed
                    ? "bg-destructive"
                    : group.events.length
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/40")
                }
              />
              <span className="font-mono text-sm">{group.ip}</span>
              <Badge
                variant={group.failed ? "destructive" : "secondary"}
                className="font-normal"
              >
                {group.failed
                  ? t("Revisar errores", "Revisar errors")
                  : group.events.length
                    ? t("Sin errores registrados", "Sense errors registrats")
                    : status === "running"
                      ? t("Esperando", "Esperant")
                      : t("Sin resultados", "Sense resultats")}
              </Badge>
              <span
                data-testid={"task-count-" + group.ip}
                className="text-xs font-normal text-muted-foreground"
              >
                {group.progress.completed} /{" "}
                {group.progress.total === null
                  ? "…"
                  : (group.progress.estimated ? "≈" : "") +
                    group.progress.total}{" "}
                {t("tareas", "tasques")}
                {group.progress.skipped > 0 &&
                  ` · ${group.progress.skipped} ${group.progress.skipped === 1 ? t("omitida", "omesa") : t("omitidas", "omeses")}`}
              </span>
            </div>
          </AccordionTrigger>
          <div className="space-y-2 pb-3">
            <Progress
              aria-label={
                t("Avance de tareas", "Avanç de tasques") + " " + group.ip
              }
              value={
                group.progress.total
                  ? Math.min(
                      100,
                      (group.progress.completed / group.progress.total) * 100,
                    )
                  : 0
              }
            />
            {status === "running" && group.progress.current_task && (
              <p className="break-words text-xs text-muted-foreground">
                {t("En curso", "En curs")}: {group.progress.current_task}
              </p>
            )}
          </div>
          <AccordionContent className="space-y-4">
            {group.events.map((event, index) => (
              <div key={index} className="space-y-2 border-t pt-4">
                <div className="flex flex-wrap items-start gap-2">
                  <Badge
                    variant={
                      ["failed", "unreachable"].includes(event.state)
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {t(
                      {
                        ok: "OK",
                        failed: "ERROR",
                        unreachable: "Sin conexión",
                        skipped: "Omitida",
                      }[event.state] || event.state,
                      { unreachable: "Sense connexió", skipped: "Omesa" }[
                        event.state
                      ],
                    )}
                    {event.changed ? " · " + t("CAMBIO", "CANVI") : ""}
                  </Badge>
                  <span className="min-w-0 break-words text-sm font-medium">
                    {event.task}
                  </span>
                </div>
                {event.time && (
                  <p className="text-xs text-muted-foreground">{event.time}</p>
                )}
                {event.details && Object.keys(event.details).length > 0 && (
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/70 p-4 font-mono text-xs leading-6">
                    {Object.entries(event.details)
                      .map(
                        ([key, value]) =>
                          key +
                          ": " +
                          (typeof value === "object"
                            ? JSON.stringify(value, null, 2)
                            : value),
                      )
                      .join("\n")}
                  </pre>
                )}
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
