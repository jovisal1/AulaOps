import { useEffect, useRef, useState } from "react";
import { usePreferences } from "@/i18n";
import { api } from "@/lib/api";
export default function useExecution({
  pending,
  confirmation,
  task,
  setForm,
  setPage,
  setPending,
  setStep,
}) {
  const { t } = usePreferences();
  const [jobId, setJobId] = useState(null),
    [job, setJob] = useState(null),
    [ipFilter, setIpFilter] = useState("all"),
    [errorsOnly, setErrorsOnly] = useState(false),
    [pollError, setPollError] = useState(false);
  const runLock = useRef(false);
  const active = !!jobId && (!job || job.status === "running");
  useEffect(() => {
    if (!jobId) return;
    let stopped = false,
      timer;
    const controller = new AbortController();
    async function poll() {
      try {
        const data = await api("jobs/" + jobId, undefined, controller.signal);
        if (stopped) return;
        setJob(data);
        setPollError(false);
        if (data.status === "running") timer = setTimeout(poll, 1500);
      } catch (error) {
        if (stopped) return;
        setPollError(true);
        timer = setTimeout(poll, 3000);
      }
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [jobId]);
  async function execute() {
    if (runLock.current || active || !pending) return;
    runLock.current = true;
    await task("run", async () => {
      if (
        pending.recipes.includes("delete_user") &&
        confirmation !== pending.delete_username
      )
        throw Error(
          t("Escribe exactamente el username para confirmar la eliminación."),
        );
      const data = await api("run", {
        ...pending,
        delete_confirmation: confirmation,
      });
      setJob(null);
      setJobId(data.id);
      setPage("execution");
      setPending(null);
      setStep(0);
      setIpFilter("all");
      setErrorsOnly(false);
      setForm((current) => ({
        ...current,
        ssh_password: "",
        sudo_password: "",
        target_password: "",
      }));
    });
    runLock.current = false;
  }
  function download() {
    if (!job) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(job, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "resumen-aula-" + job.id + ".json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const groups = (job?.hosts || []).map((ip) => {
    const events = (job.events || []).filter(
      (e) =>
        e.ip === ip || (!e.ip && e.host === "pc_" + ip.replaceAll(".", "_")),
    );
    return {
      ip,
      events,
      failed: events.some((e) => ["failed", "unreachable"].includes(e.state)),
    };
  });
  const status = job?.status || "running",
    statusText = {
      running: t("En curso"),
      successful: t("Completada"),
      failed: t("Con errores"),
      canceled: t("Cancelada"),
    }[status];

  return {
    jobId,
    job,
    active,
    ipFilter,
    setIpFilter,
    errorsOnly,
    setErrorsOnly,
    pollError,
    execute,
    download,
    groups,
    status,
    statusText,
  };
}
