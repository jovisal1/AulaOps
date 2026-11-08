import {
  ArrowRight,
  CircleAlert,
  FileText,
  Loader2,
  Monitor,
  Network,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePreferences } from "@/i18n";
import { useAulaContext } from "@/hooks/AulaContext";
export default function EquipmentPanel() {
  const { t } = usePreferences();
  const {
    hosts,
    selected,
    busy,
    networks,
    networkId,
    setNetworkId,
    networksLoading,
    networkError,
    loadNetworks,
    hasSelection,
    go,
    setSelected,
    setPending,
    toggleHost,
    addHosts,
    discover,
    saveInventory,
    setStep,
    recipes,
    field,
    form,
    manualRangeOpen,
    setManualRangeOpen,
  } = useAulaContext();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Equipos del aula", "Equips de l’aula")}</CardTitle>
        <CardDescription>
          {t(
            "Descubre equipos de la red o añade sus direcciones manualmente.",
            "Descobrix equips de la xarxa o afig les adreces manualment.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-7">
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_150px_auto]">
          <div className="space-y-2">
            <Label htmlFor="local_network">
              {t("Tu red local", "La teua xarxa local")}
            </Label>
            {networks.length > 1 ? (
              <Select
                value={networkId}
                onValueChange={setNetworkId}
                disabled={!!busy || networksLoading}
              >
                <SelectTrigger id="local_network" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {networks.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.interface} · {item.cidr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div
                id="local_network"
                className="flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm"
              >
                {networksLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Network className="size-4 text-primary" />
                )}
                {networks[0]
                  ? `${networks[0].interface} · ${networks[0].cidr}`
                  : t(
                      networkError
                        ? "No hay una red disponible"
                        : "Detectando la conexión…",
                      networkError
                        ? "No hi ha cap xarxa disponible"
                        : "Detectant la connexió…",
                    )}
              </div>
            )}
          </div>
          {field("port", "Puerto SSH", {
            type: "number",
            min: 1,
            max: 65535,
          })}
          <Button
            id="discover"
            disabled={!!busy || networksLoading || !networks.length}
            onClick={() => discover()}
          >
            {busy === "discover" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Search />
            )}
            {t(busy === "discover" ? "Buscando…" : "Descubrir")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
            {t(
              "La red se detecta automáticamente en este equipo. Se buscan servicios SSH; en redes grandes puede tardar varios minutos.",
              "La xarxa es detecta automàticament en este equip. Es busquen servicis SSH; en xarxes grans pot tardar uns quants minuts.",
            )}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={networksLoading || !!busy}
            onClick={loadNetworks}
          >
            {t("Actualizar redes", "Actualitzar xarxes")}
          </Button>
        </div>
        {networkError && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" />
            <AlertDescription>{t(networkError)}</AlertDescription>
          </Alert>
        )}
        <Accordion
          type="single"
          collapsible
          value={manualRangeOpen ? "range" : ""}
          onValueChange={(value) => setManualRangeOpen(value === "range")}
        >
          <AccordionItem value="range">
            <AccordionTrigger>
              {t(
                "Introducir rango manualmente",
                "Introduir el rang manualment",
              )}
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-1">
              <p className="text-xs leading-5 text-muted-foreground">
                {t(
                  "Si no se detecta la red o no aparecen equipos, indica el rango IPv4 del aula. Máximo 1024 direcciones (/22 o más específico).",
                  "Si no es detecta la xarxa o no apareixen equips, indica el rang IPv4 de l’aula. Màxim 1024 adreces (/22 o més específic).",
                )}
              </p>
              {field("cidr", "Rango de red del aula (CIDR)", {
                placeholder: "192.168.1.0/24",
                disabled: !!busy,
              })}
              <Button
                id="discover_manual"
                disabled={!!busy || !form.cidr.trim()}
                onClick={() => discover(form.cidr)}
              >
                {busy === "discover" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Search />
                )}
                {t("Buscar en este rango", "Buscar en este rang")}
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Separator />
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p id="count" className="text-sm font-medium">
              {selected.length} / {hosts.length}{" "}
              {t("equipos seleccionados", "equips seleccionats")}
            </p>
            <div className="flex gap-2">
              <Button
                id="all"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelected([...hosts]);
                  setPending(null);
                }}
              >
                {t("Seleccionar todos")}
              </Button>
              <Button
                id="none"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelected([]);
                  setPending(null);
                }}
              >
                {t("Ninguno")}
              </Button>
            </div>
          </div>
          {hosts.length ? (
            <div className="grid max-h-80 gap-2 overflow-auto rounded-xl border p-3 sm:grid-cols-2 lg:grid-cols-3">
              {hosts.map((ip) => (
                <div
                  key={ip}
                  className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <Checkbox
                    id={"ip-" + ip}
                    checked={selected.includes(ip)}
                    onCheckedChange={() => toggleHost(ip)}
                  />
                  <Label
                    htmlFor={"ip-" + ip}
                    className="flex-1 font-mono text-sm font-normal"
                  >
                    {ip}
                  </Label>
                  <Monitor className="size-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed py-10 text-center">
              <Network className="mx-auto mb-3 size-7 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                {t("No hay equipos en la lista.")}
              </p>
            </div>
          )}
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="manual">
            <AccordionTrigger>
              {t("Añadir direcciones manualmente")}
            </AccordionTrigger>
            <AccordionContent className="space-y-3 px-1">
              {field("manual", "Una IPv4 por línea", {
                multiline: true,
                placeholder: "192.168.1.10\n192.168.1.11",
                className: "font-mono",
              })}
              <Button id="add" variant="outline" onClick={addHosts}>
                <Plus />
                {t("Añadir equipos")}
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              id="save"
              variant="outline"
              onClick={saveInventory}
              disabled={!hasSelection || !!busy}
            >
              <FileText />
              {t("Guardar hosts.yml")}
            </Button>
            <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">
              {t(
                "Guarda solo los seleccionados. Sustituye el inventario anterior y crea una copia de seguridad.",
              )}
            </p>
          </div>
          <Button
            id="equipment_recipes"
            disabled={!hasSelection}
            onClick={() => {
              setStep(0);
              go("recipes");
            }}
          >
            {t("Lanzar recetas")}
            <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
