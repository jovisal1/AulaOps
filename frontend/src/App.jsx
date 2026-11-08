import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CircleAlert } from "lucide-react";
import Shell from "./components/Shell";
import { usePreferences } from "./i18n";
import { AulaContext } from "./hooks/AulaContext";
import useAula from "./hooks/useAula";
import GlobalVariablesPanel from "./components/GlobalVariablesPanel";
import OverviewPanel from "./components/OverviewPanel";
import EquipmentPanel from "./components/EquipmentPanel";
import RecipeWizard from "./components/RecipeWizard";
import ExecutionPanel from "./components/ExecutionPanel";
import RecipeDialog from "./components/RecipeDialog";
import ConfirmationDialog from "./components/ConfirmationDialog";
export default function App() {
  const aula = useAula();
  const { page, go, message, nav, hasSelection, jobId } = aula;
  const { t } = usePreferences();
  return (
    <AulaContext.Provider value={aula}>
      <Shell>
        <nav
          aria-label={t("Apartados")}
          className="mb-7 grid w-full grid-cols-3 gap-1 rounded-2xl border bg-muted/50 p-1.5 sm:flex sm:w-fit"
        >
          {nav.map(([id, label, Icon]) => (
            <Button
              key={id}
              id={"nav-" + id}
              data-page={id}
              variant={page === id ? "default" : "ghost"}
              className="min-w-0 flex-1 gap-2 rounded-xl px-2 text-xs sm:flex-none sm:px-5 sm:text-sm"
              disabled={
                (id === "recipes" && !hasSelection) ||
                (id === "execution" && (!hasSelection || !jobId))
              }
              aria-current={page === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon className="hidden size-4 sm:block" />
              {t(label)}
            </Button>
          ))}
        </nav>
        {message && (
          <Alert
            variant={message.error ? "destructive" : "default"}
            className="mb-6"
          >
            <CircleAlert className="size-4" />
            <AlertDescription>{t(message.text)}</AlertDescription>
          </Alert>
        )}
        {page === "home" && <OverviewPanel />}
        {page === "globals" && <GlobalVariablesPanel />}
        {page === "equipment" && <EquipmentPanel />}
        {page === "recipes" && <RecipeWizard />}
        {page === "execution" && <ExecutionPanel />}
        <RecipeDialog />
        <ConfirmationDialog />
      </Shell>
    </AulaContext.Provider>
  );
}
