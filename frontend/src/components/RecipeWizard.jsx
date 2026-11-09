import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileCode2,
  KeyRound,
  Loader2,
  Monitor,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, CheckField } from "./Fields";
import { usePreferences } from "@/i18n";
import { useAulaContext } from "@/hooks/AulaContext";
import { builtins } from "@/lib/recipes";
export default function RecipeWizard() {
  const { t } = usePreferences();
  const {
    form,
    update,
    hosts,
    selected,
    busy,
    go,
    setPending,
    setStep,
    step,
    active,
    recipes,
    setRecipes,
    custom,
    nextParameters,
    hasCustom,
    requiresTargetUser,
    pending,
    recipeName,
    confirmation,
    setConfirmation,
    setMessage,
    review,
    execute,
    setRecipeOpen,
    setRecipeError,
    field,
  } = useAulaContext();
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [sshUser, setSshUser] = useState("");
  const [sshPassword, setSshPassword] = useState("");
  const [credentialsError, setCredentialsError] = useState("");
  function closeCredentials(open) {
    setCredentialsOpen(open);
    if (!open) {
      setSshPassword("");
      setCredentialsError("");
    }
  }
  async function launch(event) {
    event.preventDefault();
    if (!/^[\p{L}\p{N}_][\p{L}\p{N}_.@\\-]{0,254}$/u.test(sshUser.trim())) {
      setCredentialsError(t("Usuario SSH inválido", "Usuari SSH invàlid"));
      return;
    }
    if (!sshPassword) {
      setCredentialsError(
        t("Introduce la contraseña SSH.", "Introduïx la contrasenya SSH."),
      );
      return;
    }
    const credentials = { ssh_user: sshUser.trim(), ssh_password: sshPassword };
    closeCredentials(false);
    await execute(credentials);
  }
  return (
    <>
      <Dialog open={credentialsOpen} onOpenChange={closeCredentials}>
        <DialogContent closeLabel={t("Cerrar")}>
          <DialogHeader>
            <DialogTitle>{t("Conexión SSH", "Connexió SSH")}</DialogTitle>
            <DialogDescription>
              {t(
                "Introduce el usuario y la contraseña de conexión. La misma contraseña se usará para sudo.",
                "Introduïx l’usuari i la contrasenya de connexió. La mateixa contrasenya s’usarà per a sudo.",
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={launch} className="space-y-5">
            <Field
              id="launch_ssh_user"
              label={t("Usuario SSH existente")}
              value={sshUser}
              onChange={setSshUser}
              autoComplete="username"
              autoFocus
            />
            <Field
              id="launch_ssh_password"
              label={t("Contraseña SSH")}
              value={sshPassword}
              onChange={setSshPassword}
              type="password"
              autoComplete="off"
            />
            {credentialsError && (
              <p role="alert" className="text-sm text-destructive">
                {credentialsError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => closeCredentials(false)}
              >
                {t("Cancelar")}
              </Button>
              <Button type="submit" disabled={!!busy || active}>
                {t("Ejecutar ahora")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>{t("Lanzar recetas")}</CardTitle>
              <CardDescription className="mt-2">
                {t(
                  "Una tarea, los parámetros justos y el resultado a la vista.",
                  "Una tasca, els paràmetres justos i el resultat a la vista.",
                )}
              </CardDescription>
            </div>
            <Button
              id="open_recipe"
              variant="outline"
              onClick={() => {
                setRecipeError("");
                setRecipeOpen(true);
              }}
            >
              <Plus />
              {t("Añadir nueva receta")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-7">
          <ol
            aria-label={t("Pasos de ejecución")}
            className="grid grid-cols-4 gap-2 rounded-xl bg-muted/60 p-2"
          >
            {["Recetas", "Parámetros", "Ejecutar", "Logs"].map(
              (label, index) => (
                <li
                  key={label}
                  aria-current={step === index ? "step" : undefined}
                  className={
                    "flex flex-col items-center gap-2 rounded-lg px-1 py-3 text-xs sm:flex-row sm:justify-center " +
                    (index === step
                      ? "bg-background font-medium text-primary shadow-sm"
                      : "text-muted-foreground")
                  }
                >
                  <span
                    className={
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs " +
                      (index < step
                        ? "bg-primary/10 text-primary"
                        : index === step
                          ? "bg-primary text-primary-foreground"
                          : "border")
                    }
                  >
                    {index < step ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  {t(
                    label,
                    {
                      Recetas: "Receptes",
                      Parámetros: "Paràmetres",
                      Ejecutar: "Executar",
                    }[label],
                  )}
                </li>
              ),
            )}
          </ol>
          {active && (
            <Alert>
              <Loader2 className="size-4 animate-spin" />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                {t(
                  "Ya hay una ejecución activa. Espera o cancélala.",
                  "Ja hi ha una execució activa. Espera o cancel·la-la.",
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => go("execution")}
                >
                  {t("Ver logs", "Vore logs")}
                  <ArrowRight />
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {step === 0 && (
            <section data-step="selection" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-medium">{t("Selecciona las recetas")}</h2>
                <Badge variant="secondary">
                  {recipes.length}{" "}
                  {recipes.length === 1
                    ? t("seleccionada", "seleccionada")
                    : t("seleccionadas", "seleccionades")}
                </Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ...builtins,
                  ...custom.map((r) => [
                    r.id,
                    r.name,
                    r.description || "Tareas de Ansible añadidas por ti",
                    FileCode2,
                  ]),
                ].map(([id, title, description, Icon]) => {
                  const checked = recipes.includes(id),
                    personal = id.startsWith("custom_");
                  return (
                    <div
                      key={id}
                      className={
                        "relative flex items-start gap-3 rounded-xl border p-4 transition-colors " +
                        (checked
                          ? "border-primary/60 bg-primary/5"
                          : "hover:bg-muted/40")
                      }
                    >
                      <Checkbox
                        id={"recipe-" + id}
                        checked={checked}
                        onCheckedChange={(value) => {
                          setRecipes((current) =>
                            value
                              ? id === "check"
                                ? [id, ...current]
                                : [...current, id]
                              : current.filter((r) => r !== id),
                          );
                          setPending(null);
                        }}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <Label
                          htmlFor={"recipe-" + id}
                          className="cursor-pointer items-start gap-2 text-sm leading-5"
                        >
                          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          {personal ? title : t(title)}
                        </Label>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {personal ? description : t(description)}
                        </p>
                        {personal && (
                          <>
                            <Badge
                              variant="outline"
                              className="mt-3 text-[10px]"
                            >
                              {custom.find((recipe) => recipe.id === id)
                                ?.bundled
                                ? t("Incluida", "Inclosa")
                                : t("Personalizada", "Personalitzada")}
                            </Badge>
                            <Accordion type="single" collapsible>
                              <AccordionItem value="yaml" className="border-0">
                                <AccordionTrigger className="py-3 text-xs">
                                  {t("Ver YAML", "Vore YAML")}
                                </AccordionTrigger>
                                <AccordionContent>
                                  <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                                    {custom.find((r) => r.id === id)?.content}
                                  </pre>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {recipes.length > 1 && (
                <div className="space-y-3 rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">
                    {t("Orden de ejecución", "Ordre d’execució")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Usa las flechas para ordenar las recetas. La comprobación previa se ejecuta primero.",
                      "Usa les fletxes per a ordenar les receptes. La comprovació prèvia s’executa primer.",
                    )}
                  </p>
                  <ol className="space-y-2" data-testid="recipe-order">
                    {recipes.map((id, index) => (
                      <li
                        key={id}
                        data-recipe-id={id}
                        className="flex items-center gap-2 rounded-lg bg-muted/40 p-2 text-sm"
                      >
                        <span className="min-w-5 text-muted-foreground">
                          {index + 1}.
                        </span>
                        <span className="flex-1">{recipeName(id)}</span>
                        {[-1, 1].map((direction) => (
                          <Button
                            key={direction}
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={
                              (direction < 0
                                ? t("Subir", "Pujar")
                                : t("Bajar", "Baixar")) +
                              " " +
                              recipeName(id)
                            }
                            disabled={
                              active ||
                              id === "check" ||
                              index + direction < 0 ||
                              index + direction >= recipes.length ||
                              recipes[index + direction] === "check"
                            }
                            onClick={() => {
                              setRecipes((current) => {
                                const next = [...current];
                                [next[index], next[index + direction]] = [
                                  next[index + direction],
                                  next[index],
                                ];
                                return next;
                              });
                              setPending(null);
                            }}
                          >
                            {direction < 0 ? (
                              <ArrowUp className="size-4" />
                            ) : (
                              <ArrowDown className="size-4" />
                            )}
                          </Button>
                        ))}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="flex justify-end border-t pt-5">
                <Button
                  id="to_parameters"
                  disabled={!recipes.length || active}
                  onClick={nextParameters}
                >
                  {t("Siguiente: parámetros")}
                  <ArrowRight />
                </Button>
              </div>
            </section>
          )}
          {step === 1 && (
            <section data-step="parameters" className="space-y-7">
              <div>
                <h2 className="font-medium">
                  {t("Parámetros de las recetas")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(
                    recipes.length === 1 && recipes[0] === "check"
                      ? "Esta receta solo necesita los equipos y la conexión SSH."
                      : "Completa los campos de las recetas seleccionadas.",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-3">
                  <Monitor className="size-5 text-primary" />
                  <p className="text-sm">
                    <strong>{selected.length}</strong>{" "}
                    {t("equipos seleccionados", "equips seleccionats")}{" "}
                    <span className="mx-2 text-muted-foreground">·</span> SSH{" "}
                    {form.port}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => go("equipment")}
                >
                  {t("Cambiar equipos")}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(
                  "El usuario y la contraseña SSH se solicitarán al ejecutar.",
                  "L’usuari i la contrasenya SSH se sol·licitaran en executar.",
                )}
              </p>
              {requiresTargetUser ? (
                <>
                  <Separator />
                  <div className="max-w-xl">
                    {field("target_user", "Usuario del aula", {
                      autoComplete: "off",
                    })}
                  </div>
                </>
              ) : null}
              {recipes.includes("user") && (
                <div className="space-y-5 rounded-xl border p-5">
                  <h3 className="text-sm font-semibold">
                    {t("Crear usuario del aula")}
                  </h3>
                  {field("target_password", "Contraseña del usuario del aula", {
                    type: "password",
                    autoComplete: "new-password",
                  })}
                  <CheckField
                    id="user_sudo"
                    checked={form.user_sudo}
                    onChange={(value) => update("user_sudo", value)}
                  >
                    {t(
                      "Permitir administrar el equipo (sudo)",
                      "Permetre administrar l’equip (sudo)",
                    )}
                  </CheckField>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Si lo desmarcas, se retira la cuenta del grupo sudo aunque ya exista. Conserva los demás grupos.",
                      "Si ho desmarques, es retira el compte del grup sudo encara que ja existisca. Conserva els altres grups.",
                    )}
                  </p>
                  <CheckField
                    id="reset_password"
                    checked={form.reset_password}
                    onChange={(value) => update("reset_password", value)}
                  >
                    {t("Cambiar también la contraseña si el usuario ya existe")}
                  </CheckField>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Por defecto, la contraseña solo se establece al crear la cuenta.",
                    )}
                  </p>
                </div>
              )}
              {(recipes.includes("java") || hasCustom) && (
                <div className="max-w-xs">
                  {field("jdk", "Versión OpenJDK", {
                    type: "number",
                    min: 8,
                    max: 99,
                    help: t(
                      "Si JDK 21 no está en APT, se descargará Temurin oficial desde el equipo de control y se copiará por SSH.",
                      "Si JDK 21 no està en APT, es descarregarà Temurin oficial des de l’equip de control i es copiarà per SSH.",
                    ),
                  })}
                </div>
              )}
              {(recipes.includes("vscode") || hasCustom) && (
                <div className="space-y-5 rounded-xl border p-5">
                  <h3 className="text-sm font-semibold">
                    {t("VS Code: extensiones y ajustes")}
                  </h3>
                  {field("extensions", "Extensiones (una por línea)", {
                    multiline: true,
                    className: "font-mono text-xs",
                    rows: 3,
                  })}
                  {field(
                    "settings",
                    "settings.json (JSON válido, sin comentarios)",
                    {
                      multiline: true,
                      className: "font-mono text-xs",
                      rows: 7,
                    },
                  )}
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t(
                      "Sustituye settings.json conservando una copia del archivo anterior. Las extensiones se instalan para el usuario del aula.",
                    )}
                  </p>
                </div>
              )}
              {(recipes.includes("folders") || hasCustom) && (
                <div className="space-y-5 rounded-xl border p-5">
                  <h3 className="text-sm font-semibold">
                    {t("Carpetas para el escritorio")}
                  </h3>
                  {recipes.includes("folders") && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="selected_files">
                          {t("Archivos para copiar", "Fitxers per a copiar")}
                        </Label>
                        <input
                          id="selected_files"
                          type="file"
                          multiple
                          className="block w-full rounded-md border p-2 text-sm"
                          onChange={(event) => {
                            const added = Array.from(event.target.files || []);
                            update("files", [
                              ...form.files.filter(
                                (file) =>
                                  !added.some(
                                    (item) => item.name === file.name,
                                  ),
                              ),
                              ...added,
                            ]);
                            event.target.value = "";
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t(
                            "Hasta 50 archivos y 20 MiB en total. Puedes añadir más archivos con el selector.",
                            "Fins a 50 fitxers i 20 MiB en total. Pots afegir més fitxers amb el selector.",
                          )}
                        </p>
                        <ul className="space-y-1">
                          {form.files.map((file) => (
                            <li
                              key={file.name}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="break-all">{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={
                                  t("Quitar", "Llevar") + " " + file.name
                                }
                                onClick={() =>
                                  update(
                                    "files",
                                    form.files.filter((item) => item !== file),
                                  )
                                }
                              >
                                {t("Quitar", "Llevar")}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {field(
                        "destination_folder",
                        "Carpeta de destino en el escritorio",
                        { placeholder: "Materiales", maxLength: 128 },
                      )}
                    </>
                  )}
                  {field("folders", "Rutas locales absolutas (una por línea)", {
                    multiline: true,
                    placeholder: "/home/profesor/Materiales",
                    className: "font-mono text-xs",
                  })}
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t(
                      "Antes de copiar se borran todas las carpetas existentes del escritorio y su contenido, incluida la carpeta de destino anterior. Los archivos sueltos y los enlaces simbólicos se conservan.",
                    )}
                  </p>
                </div>
              )}
              {recipes.includes("delete_user") && (
                <div className="space-y-5 rounded-xl border border-destructive/40 p-5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Trash2 className="size-4 text-destructive" />
                    {t("Opciones de eliminación de usuario")}
                  </h3>
                  {field("delete_username", "Username que quieres eliminar", {
                    autoComplete: "off",
                    placeholder: "alumno_antiguo",
                  })}
                  <CheckField
                    id="delete_home"
                    checked={form.delete_home}
                    onChange={(value) => update("delete_home", value)}
                  >
                    {t("Borrar también su carpeta personal y correo local")}
                  </CheckField>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t(
                      "Conservar el home es la opción predeterminada. La eliminación no fuerza el cierre de sesiones. No se permiten cuentas del sistema ni tu usuario SSH.",
                    )}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
                <Button
                  id="to_selection"
                  variant="outline"
                  onClick={() => {
                    setStep(0);
                    setMessage(null);
                  }}
                >
                  <ArrowLeft />
                  {t("Anterior: recetas")}
                </Button>
                <Button id="run" disabled={active} onClick={review}>
                  {t("Siguiente: revisar ejecución")}
                  <ArrowRight />
                </Button>
              </div>
            </section>
          )}
          {step === 2 && pending && (
            <section data-step="review" className="space-y-6">
              <div>
                <h2 className="font-medium">{t("Revisar ejecución")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(
                    "Las recetas seleccionadas se aplicarán a estos equipos. Las instalaciones requieren acceso a sus repositorios.",
                  )}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border p-5">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("Equipos")}{" "}
                    <span className="ml-1">({pending.hosts.length})</span>
                  </p>
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
                    {pending.hosts.map((ip) => (
                      <Badge
                        key={ip}
                        variant="secondary"
                        className="font-mono font-normal"
                      >
                        {ip}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-3 rounded-xl border p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("Recetas", "Receptes")}
                  </p>
                  {pending.recipes.map((id, index) => (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-primary" />
                      {index + 1}. {recipeName(id)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-muted/50 p-5 text-sm">
                <p>
                  SSH{" "}
                  <span className="ml-2 font-mono">
                    {t("Credenciales al ejecutar", "Credencials en executar")} ·{" "}
                    {pending.port}
                  </span>
                </p>
                {requiresTargetUser && (
                  <p className="mt-3">
                    {t("Usuario del aula")}:{" "}
                    <strong>{pending.target_user}</strong>
                  </p>
                )}
                {pending.recipes.includes("user") && (
                  <p className="mt-3">
                    {t("Administración (sudo)", "Administració (sudo)")}:{" "}
                    <strong>{pending.user_sudo ? t("Sí") : t("No")}</strong>
                  </p>
                )}
                {(pending.recipes.includes("java") || hasCustom) && (
                  <p className="mt-3">
                    OpenJDK: <strong>{pending.jdk}</strong>
                  </p>
                )}
                {(pending.recipes.includes("vscode") || hasCustom) && (
                  <div className="mt-3 space-y-2">
                    <p>
                      VS Code:{" "}
                      {pending.extensions.join(", ") ||
                        t("Sin extensiones", "Sense extensions")}
                    </p>
                    <pre className="overflow-auto rounded-lg border bg-background p-3 text-xs">
                      {JSON.stringify(pending.settings, null, 2)}
                    </pre>
                  </div>
                )}
                {pending.recipes.includes("folders") && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {t(
                        "Se eliminarán todas las carpetas existentes del escritorio y su contenido antes de copiar. Esta operación no tiene deshacer.",
                        "S’eliminaran totes les carpetes existents de l’escriptori i el seu contingut abans de copiar. Esta operació no es pot desfer.",
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                {pending.files?.length > 0 && (
                  <div className="space-y-2 text-sm">
                    <p>
                      {t("Carpeta de destino en el escritorio")}:{" "}
                      <strong>{pending.destination_folder}</strong>
                    </p>
                    <ul>
                      {pending.files.map((file) => (
                        <li key={file.name}>{file.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(pending.recipes.includes("folders") || hasCustom) &&
                  pending.folders.length > 0 && (
                    <div className="mt-3">
                      <p>{t("Carpetas para el escritorio")}</p>
                      <ul className="mt-2 space-y-1 font-mono text-xs">
                        {pending.folders.map((path) => (
                          <li className="break-all" key={path}>
                            {path}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
              {pending.recipes.includes("delete_user") && (
                <Alert variant="destructive">
                  <Trash2 className="size-4" />
                  <AlertTitle>
                    {t("Eliminar usuario por username")}:{" "}
                    {pending.delete_username}
                  </AlertTitle>
                  <AlertDescription className="space-y-4">
                    <p>
                      {t(
                        "Eliminar la cuenta no tiene deshacer. Si marcas borrar la carpeta personal, sus archivos también se eliminarán.",
                      )}
                    </p>
                    <p className="font-semibold">
                      {t(
                        pending.delete_home
                          ? "Borrar también su carpeta personal y correo local"
                          : "Conservar la carpeta personal",
                        pending.delete_home
                          ? undefined
                          : "Conservar la carpeta personal",
                      )}
                    </p>
                    <Field
                      id="delete_confirmation"
                      label={t(
                        "Escribe el username que vas a eliminar para confirmar",
                      )}
                      value={confirmation}
                      onChange={setConfirmation}
                      autoComplete="off"
                    />
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
                <Button
                  id="back"
                  variant="outline"
                  disabled={busy === "run"}
                  onClick={() => {
                    setPending(null);
                    setStep(1);
                    setMessage(null);
                  }}
                >
                  <ArrowLeft />
                  {t("Volver")}
                </Button>
                <Button
                  id="confirm"
                  disabled={
                    active ||
                    !!busy ||
                    (pending.recipes.includes("delete_user") &&
                      confirmation !== pending.delete_username)
                  }
                  onClick={() => {
                    setSshUser(form.ssh_user);
                    setSshPassword("");
                    setCredentialsOpen(true);
                  }}
                >
                  {busy === "run" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Play />
                  )}
                  {t("Ejecutar ahora")}
                </Button>
              </div>
            </section>
          )}
        </CardContent>
      </Card>
    </>
  );
}
