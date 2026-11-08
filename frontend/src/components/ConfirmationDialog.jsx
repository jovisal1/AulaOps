import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePreferences } from "@/i18n";
import { useAulaContext } from "@/hooks/AulaContext";
export default function ConfirmationDialog() {
  const { t } = usePreferences();
  const { setConfirmAction, confirmAction } = useAulaContext();
  return (
    <Dialog
      open={!!confirmAction}
      onOpenChange={(open) => {
        if (!open) setConfirmAction(null);
      }}
    >
      <DialogContent closeLabel={t("Cerrar")}>
        <DialogHeader>
          <DialogTitle>{confirmAction?.title}</DialogTitle>
          <DialogDescription>{confirmAction?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("Volver")}</Button>
          </DialogClose>
          <Button
            onClick={() => {
              const action = confirmAction?.run;
              setConfirmAction(null);
              action?.();
            }}
          >
            {t("Continuar", "Continuar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
