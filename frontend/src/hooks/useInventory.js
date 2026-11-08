import { useEffect, useState } from "react";
import { usePreferences } from "@/i18n";
import { api } from "@/lib/api";
import { splitLines } from "@/lib/aulaForm";
export default function useInventory({
  page,
  form,
  setForm,
  update,
  port,
  task,
  notify,
  setConfirmAction,
  invalidate,
}) {
  const { t } = usePreferences();
  const [hosts, setHosts] = useState([]),
    [selected, setSelected] = useState([]),
    [inventory, setInventory] = useState(null),
    [inventoryError, setInventoryError] = useState("");
  const [networks, setNetworks] = useState([]),
    [networkId, setNetworkId] = useState(""),
    [networkError, setNetworkError] = useState(""),
    [networksLoading, setNetworksLoading] = useState(false);
  const [manualRangeOpen, setManualRangeOpen] = useState(false);
  async function loadNetworks() {
    setNetworksLoading(true);
    setNetworkError("");
    try {
      const data = await api("networks");
      setNetworks(data.networks);
      setNetworkId((current) =>
        data.networks.some((item) => item.id === current)
          ? current
          : data.networks[0]?.id || "",
      );
    } catch (error) {
      setNetworks([]);
      setNetworkId("");
      setNetworkError(error.message);
      setManualRangeOpen(true);
    } finally {
      setNetworksLoading(false);
    }
  }
  useEffect(() => {
    if (page === "equipment") loadNetworks();
  }, [page]);
  useEffect(() => {
    const controller = new AbortController();
    api("inventory", undefined, controller.signal)
      .then((data) => {
        setInventory(data);
        setHosts(data.hosts);
        setSelected(data.hosts);
        setForm((current) => ({ ...current, port: String(data.port) }));
      })
      .catch((error) => {
        if (error.name !== "AbortError") setInventoryError(error.message);
      });
    return () => {
      controller.abort();
    };
  }, []);
  function toggleHost(ip) {
    setSelected((current) =>
      current.includes(ip) ? current.filter((v) => v !== ip) : [...current, ip],
    );
    invalidate();
  }
  function addHosts() {
    const ips = splitLines(form.manual);
    if (
      !ips.length ||
      ips.some(
        (ip) =>
          !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ||
          ip.split(".").some((v) => +v > 255),
      )
    )
      return notify(t("Introduce direcciones IPv4 válidas."), true);
    setHosts((current) => [...new Set([...current, ...ips])]);
    setSelected((current) => [...new Set([...current, ...ips])]);
    invalidate();
    update("manual", "");
  }
  function discover(cidr = null) {
    if (cidr !== null && !cidr.trim())
      return notify(
        t(
          "Introduce el rango de red del aula.",
          "Introduïx el rang de xarxa de l’aula.",
        ),
        true,
      );
    const operation = () =>
      task("discover", async () => {
        const data = await api("discover", {
          ...(cidr === null
            ? { network: networkId || undefined }
            : { cidr: cidr.trim() }),
          port: port(),
        }).catch((error) => {
          setManualRangeOpen(true);
          throw error;
        });
        if (!data.hosts.length) setManualRangeOpen(true);
        setHosts(data.hosts);
        setSelected(data.hosts);
        invalidate();
        notify(
          `${data.hosts.length} ${t("servicios SSH detectados", "servicis SSH detectats")}`,
        );
      });
    if (hosts.length)
      setConfirmAction({
        title: t(
          "Sustituir la lista de equipos",
          "Substituir la llista d’equips",
        ),
        description: t(
          "¿Sustituir la lista visible por los equipos descubiertos? El inventario guardado no cambiará.",
        ),
        run: operation,
      });
    else operation();
  }
  function saveInventory() {
    setConfirmAction({
      title: t("Guardar hosts.yml"),
      description: t(
        "Guarda solo los seleccionados. Sustituye el inventario anterior y crea una copia de seguridad.",
      ),
      run: () =>
        task("save", async () => {
          await api("inventory", { hosts: selected, port: port() });
          const data = await api("inventory");
          setInventory(data);
          setInventoryError("");
          notify(t("Inventario guardado · hosts.yml"));
        }),
    });
  }

  return {
    hosts,
    selected,
    setSelected,
    inventory,
    inventoryError,
    hasSelection: selected.length > 0,
    networks,
    networkId,
    setNetworkId,
    networkError,
    networksLoading,
    manualRangeOpen,
    setManualRangeOpen,
    loadNetworks,
    toggleHost,
    addHosts,
    discover,
    saveInventory,
  };
}
