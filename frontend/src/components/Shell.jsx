import {
  Globe2,
  Moon,
  Sun,
  Layers,
  Check,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePreferences } from "@/i18n";
export default function Shell({ children, installer = false }) {
  const { t, language, setLanguage, theme, setTheme } = usePreferences();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a
            href="/"
            className="flex items-center gap-3"
            aria-label="Aula Ansible"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Layers className="size-5" />
            </span>
            <span className="text-xl font-bold tracking-tight">
              Aula
              <span className="ml-2 hidden text-sm font-normal text-muted-foreground sm:inline">
                / Ansible
              </span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="mr-4 hidden gap-2 rounded-full px-3 py-1.5 text-muted-foreground md:flex"
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {t("Control local · LliureX · SSH")}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  id="language"
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-xl"
                  aria-label={t("Cambiar idioma")}
                  title={t("Cambiar idioma")}
                >
                  <Globe2 className="size-5" />
                  <span className="sr-only">
                    {language === "ca" ? "Valencià" : "Castellano"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t("Idioma")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[
                  ["es", "Castellano"],
                  ["ca", "Valencià"],
                ].map(([code, name]) => (
                  <DropdownMenuItem
                    key={code}
                    onSelect={() => setLanguage(code)}
                    data-language={code}
                    className="justify-between"
                  >
                    <span lang={code}>{name}</span>
                    {language === code && <Check className="size-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              id="theme"
              variant="ghost"
              size="icon"
              className="size-10 rounded-xl"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={t("Cambiar tema")}
              aria-pressed={theme === "dark"}
              title={t("Cambiar tema")}
            >
              {theme === "dark" ? (
                <Sun className="size-5" />
              ) : (
                <Moon className="size-5" />
              )}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <div className="mb-9 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-primary">
              <span className="h-px w-5 bg-primary" />
              {installer
                ? t("Puesta en marcha", "Posada en marxa")
                : t("Gestión del aula", "Gestió de l’aula")}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {installer
                ? t("Todo listo para empezar", "Tot a punt per a començar")
                : t("Prepara tu aula")}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              {installer
                ? t(
                    "Prepara las dependencias de tu equipo y abre la aplicación.",
                    "Prepara les dependències del teu equip i obri l’aplicació.",
                  )
                : t(
                    "Descubre equipos, configura recetas y sigue cada ejecución.",
                  )}
            </p>
          </div>
          <Badge
            variant="secondary"
            className="gap-2 rounded-full px-3 py-2 font-normal"
          >
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            {t("Solo en este equipo", "Només en este equip")}
          </Badge>
        </div>
        {children}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground">
          <span>
            Aula Ansible <span className="mx-2 opacity-40">/</span> LliureX
          </span>
          <span className="flex items-center gap-1.5">
            {t(
              "Ejecuta primero una prueba sobre un único PC",
              "Executa primer una prova en un únic PC",
            )}
            <ArrowUpRight className="size-3.5" />
          </span>
        </footer>
      </main>
    </div>
  );
}
