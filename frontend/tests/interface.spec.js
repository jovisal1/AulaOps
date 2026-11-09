import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const dist = path.resolve("../web/dist");
async function setup(
  page,
  {
    hosts = [],
    mode = "application",
    jobStatus = "successful",
    inventoryError = false,
    failedRecipe = false,
    catalogue = [],
    progress = undefined,
  } = {},
) {
  const calls = {
    globals: [],
    runs: [],
    recipes: [],
    cancel: 0,
    install: [],
    errors: [],
    discoveries: [],
  };
  page.on("pageerror", (error) => calls.errors.push(error.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem("aula-language"))
      localStorage.setItem("aula-language", "es");
    if (!localStorage.getItem("aula-theme"))
      localStorage.setItem("aula-theme", "light");
  });
  await page.route("http://aula.test/**", async (route) => {
    const url = new URL(route.request().url()),
      request = route.request(),
      name = url.pathname;
    if (name === "/")
      return route.fulfill({
        contentType: "text/html",
        headers: {
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'",
        },
        body: fs
          .readFileSync(path.join(dist, "index.html"), "utf8")
          .replace("__TOKEN__", "test-token")
          .replace("__MODE__", mode),
      });
    if (name.startsWith("/assets/"))
      return route.fulfill({
        contentType: name.endsWith(".css") ? "text/css" : "text/javascript",
        body: fs.readFileSync(path.join(dist, name)),
      });
    let data;
    if (name === "/api/globals") {
      const variables = {
        aula_user: "alumno",
        aula_jdk: "21",
        aula_extensions: ["vscjava.vscode-java-pack"],
        aula_settings: {
          "editor.fontSize": 14,
          "editor.formatOnSave": true,
          "files.autoSave": "afterDelay",
        },
        aula_folders: [],
        aula_reset_password: false,
        aula_delete_home: false,
      };
      if (request.method() === "POST") {
        calls.globals.push(request.postDataJSON());
        variables.aula_user = "estudiante";
        variables.aula_jdk = "25";
      }
      return route.fulfill({
        json: {
          variables,
          content:
            request.method() === "POST"
              ? request.postDataJSON().content
              : "aula_user: alumno\naula_jdk: '21'\n",
        },
      });
    }
    if (name === "/api/networks")
      data = {
        networks: [
          {
            id: "eth0:192.168.1.5/24",
            interface: "eth0",
            address: "192.168.1.5",
            cidr: "192.168.1.0/24",
          },
        ],
      };
    else if (name === "/api/discover") {
      calls.discoveries.push(request.postDataJSON());
      data = {
        hosts: ["192.168.1.20"],
        network: {
          id: "eth0:192.168.1.5/24",
          interface: "eth0",
          address: "192.168.1.5",
          cidr: "192.168.1.0/24",
        },
      };
    } else if (name === "/api/inventory") {
      if (inventoryError)
        return route.fulfill({
          status: 400,
          json: { error: "YAML inválido. Revisa la indentación y el formato." },
        });
      data = { exists: hosts.length > 0, hosts, port: 2222 };
    } else if (name === "/api/recipes") {
      if (request.method() === "GET") data = { recipes: catalogue };
      else {
        calls.recipes.push(request.postDataJSON());
        if (failedRecipe)
          return route.fulfill({
            status: 400,
            json: {
              error: "YAML inválido. Revisa la indentación y el formato.",
            },
          });
        data = { id: "custom_1", ...request.postDataJSON() };
      }
    } else if (name === "/api/run") {
      calls.runs.push(request.postDataJSON());
      data = { id: "test-job" };
    } else if (name === "/api/jobs/test-job")
      data = {
        id: "test-job",
        status: jobStatus,
        progress,
        hosts: hosts.length ? hosts : ["192.168.1.2"],
        events: [
          {
            ip: hosts[0] || "192.168.1.2",
            state: "failed",
            task: "Prueba de conexión",
            time: "2026-11-08T20:00:00Z",
            details: { stderr: "SSH de prueba", rc: 255 },
          },
        ],
      };
    else if (name === "/api/cancel/test-job") {
      calls.cancel++;
      data = { cancel: true };
    } else if (name === "/status")
      data = { status: "idle", ready: true, missing: [], log: [], error: "" };
    else if (name === "/install") {
      calls.install.push(request.postDataJSON());
      data = { started: true };
    } else throw Error("Unexpected request: " + name);
    return route.fulfill({ json: data });
  });
  await page.goto("http://aula.test/");
  await expect(page.locator("h1")).toBeVisible();
  if (mode === "application")
    await expect(page.locator("#nav-home")).toBeVisible();
  return calls;
}
async function openRecipes(page) {
  await page.locator("#nav-recipes").click();
}
async function launchWithCredentials(page) {
  await page.locator("#confirm").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#launch_ssh_user").fill("profesor");
  await page.locator("#launch_ssh_password").fill("fake-test-secret");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ejecutar ahora" })
    .click();
}
async function reviewCheck(page) {
  await openRecipes(page);
  await page.locator("#to_parameters").click();
  await page.locator("#run").click();
}

test("access follows host selection and a successfully started execution", async ({
  page,
}) => {
  const calls = await setup(page);
  await expect(page.locator("#nav-recipes")).toBeDisabled();
  await expect(page.locator("#nav-execution")).toBeDisabled();
  await page.locator("#nav-equipment").click();
  await page
    .getByRole("button", { name: "Añadir direcciones manualmente" })
    .click();
  await page.locator("#manual").fill("192.168.1.2");
  await page.locator("#add").click();
  await expect(page.locator("#nav-recipes")).toBeEnabled();
  await expect(page.locator("#nav-execution")).toBeDisabled();
  await reviewCheck(page);
  expect(calls.runs).toHaveLength(0);
  await expect(page.locator("#nav-execution")).toBeDisabled();
  await launchWithCredentials(page);
  await expect(page.locator("#status")).toHaveText("Completada");
  expect(calls.runs).toHaveLength(1);
  await expect(page.locator("#nav-execution")).toBeEnabled();
  await expect(page.getByText("SSH de prueba", { exact: false })).toBeVisible();
  await page.locator("#nav-equipment").click();
  await page.locator("#none").click();
  await expect(page.locator("#nav-recipes")).toBeDisabled();
  await expect(page.locator("#nav-execution")).toBeDisabled();
  expect(calls.errors).toEqual([]);
});

test("saved inventory and wizard parameters persist going back without executing early", async ({
  page,
}) => {
  const calls = await setup(page, { hosts: ["192.168.1.2", "192.168.1.3"] });
  await expect(page.getByText("Inventario guardado · hosts.yml")).toBeVisible();
  await expect(page.getByText("2222", { exact: true })).toBeVisible();
  await page.locator("#continue_inventory").click();
  await page.locator("#recipe-java").check();
  await page.locator("#to_parameters").click();
  await expect(page.locator("#jdk")).toBeVisible();
  await expect(page.locator("#target_password")).toHaveCount(0);
  await expect(page.locator("#delete_username")).toHaveCount(0);
  await page.locator("#jdk").fill("25");
  await page.locator("#run").click();
  await expect(page.getByText("OpenJDK:", { exact: false })).toBeVisible();
  expect(calls.runs).toHaveLength(0);
  await page.locator("#back").click();
  await expect(page.locator("#jdk")).toHaveValue("25");
  await expect(page.locator("#ssh_user")).toHaveCount(0);
  await page.locator("#run").click();
  await launchWithCredentials(page);
  await expect(page.locator("#status")).toHaveText("Completada");
  expect(calls.runs[0].port).toBe(2222);
  expect(calls.runs[0].jdk).toBe("25");
  await page.locator("#new_execution").click();
  await page.locator("#to_parameters").click();
  await expect(page.locator("#ssh_password")).toHaveCount(0);
  expect(calls.errors).toEqual([]);
});

test("recipe modal imports YAML, preserves selected recipes and saves without running", async ({
  page,
}) => {
  const calls = await setup(page, { hosts: ["192.168.1.2"] });
  await openRecipes(page);
  await page.locator("#open_recipe").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#recipe_file").setInputFiles({
    name: "Git.yml",
    mimeType: "text/yaml",
    buffer: Buffer.from(
      "- name: Comprobar\n  ansible.builtin.debug:\n    msg: hola",
    ),
  });
  await expect(page.locator("#recipe_name")).toHaveValue("Git");
  await expect(page.locator("#recipe_yaml")).toHaveValue(
    /ansible.builtin.debug/,
  );
  await page.locator("#save_recipe").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#recipe-custom_1")).not.toBeChecked();
  await expect(page.locator("#recipe-check")).toBeChecked();
  expect(calls.recipes).toHaveLength(1);
  expect(calls.runs).toHaveLength(0);
  await page.locator("#open_recipe").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#open_recipe")).toBeFocused();
  expect(calls.errors).toEqual([]);
});

test("deletion cannot mix setup recipes and requires the exact username", async ({
  page,
}) => {
  const calls = await setup(page, { hosts: ["192.168.1.2"] });
  await openRecipes(page);
  await page.locator("#recipe-delete_user").check();
  await page.locator("#recipe-java").check();
  await page.locator("#to_parameters").click();
  await expect(
    page.getByText(
      "Ejecuta la eliminación por separado de las recetas de configuración.",
    ),
  ).toBeVisible();
  await page.locator("#recipe-java").uncheck();
  await page.locator("#to_parameters").click();
  await page.locator("#delete_username").fill("alumno");
  await page.locator("#run").click();
  await expect(page.locator("#confirm")).toBeDisabled();
  await page.locator("#delete_confirmation").fill("otro");
  await expect(page.locator("#confirm")).toBeDisabled();
  await page.locator("#delete_confirmation").fill("alumno");
  await launchWithCredentials(page);
  await expect(page.locator("#status")).toHaveText("Completada");
  expect(calls.runs[0].delete_home).toBe(false);
  expect(calls.runs[0].delete_confirmation).toBe("alumno");
});

test("language and theme icon controls persist, with no horizontal overflow on mobile", async ({
  page,
}) => {
  const calls = await setup(page, { hosts: ["192.168.1.2"] });
  await page.locator("#language").click();
  await page.locator("[data-language=ca]").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ca");
  await expect(page.locator("#nav-recipes")).toHaveText("Llançar receptes");
  await page.locator("#theme").click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "ca");
  await page.setViewportSize({ width: 390, height: 844 });
  await openRecipes(page);
  await expect(page.locator("#open_recipe")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#open_recipe").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.locator("#language").click();
  await page.locator("[data-language=es]").click();
  await expect(page.locator("#nav-recipes")).toHaveText("Lanzar recetas");
  expect(calls.errors).toEqual([]);
});

test("running job blocks a second execution and cancellation is explicit", async ({
  page,
}) => {
  const calls = await setup(page, {
    hosts: ["192.168.1.2"],
    jobStatus: "running",
  });
  await reviewCheck(page);
  await launchWithCredentials(page);
  await expect(page.locator("#status")).toHaveText("En curso");
  await expect(page.locator("#new_execution")).toBeDisabled();
  await page.locator("#cancel").click();
  expect(calls.cancel).toBe(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continuar", exact: true })
    .click();
  await expect.poll(() => calls.cancel).toBe(1);
  await openRecipes(page);
  await expect(page.locator("#to_parameters")).toBeDisabled();
  expect(calls.runs).toHaveLength(1);
});

test("recipe validation errors stay inside the modal", async ({ page }) => {
  const calls = await setup(page, {
    hosts: ["192.168.1.2"],
    failedRecipe: true,
  });
  await openRecipes(page);
  await page.locator("#open_recipe").click();
  await page.locator("#recipe_name").fill("Incorrecta");
  await page.locator("#save_recipe").click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("YAML inválido. Revisa la indentación y el formato."),
  ).toBeVisible();
  await expect(page.locator("#recipe_name")).toHaveValue("Incorrecta");
  expect(calls.runs).toHaveLength(0);
});

test("installer uses the same components, preferences and dependency status", async ({
  page,
}) => {
  const calls = await setup(page, { mode: "installer" });
  await expect(
    page.getByRole("button", { name: "Abrir aplicación" }),
  ).toBeVisible();
  await expect(page.locator("#nav-recipes")).toHaveCount(0);
  await page.locator("#language").click();
  await page.locator("[data-language=ca]").click();
  await expect(
    page.getByRole("button", { name: "Obrir aplicació" }),
  ).toBeVisible();
  expect(calls.errors).toEqual([]);
});

test("changing destinations after review returns to editable parameters", async ({
  page,
}) => {
  await setup(page, { hosts: ["192.168.1.2", "192.168.1.3"] });
  await reviewCheck(page);
  await page.locator("#nav-equipment").click();
  await page.locator("#ip-192\\.168\\.1\\.3").uncheck();
  await openRecipes(page);
  await expect(page.locator('[data-step="parameters"]')).toBeVisible();
  await expect(page.locator("#ssh_user")).toHaveCount(0);
  await expect(page.locator("#confirm")).toHaveCount(0);
});

test("a rejected start keeps logs disabled and preserves the review", async ({
  page,
}) => {
  const calls = await setup(page, { hosts: ["192.168.1.2"] });
  await page.route("http://aula.test/api/run", (route) =>
    route.fulfill({
      status: 400,
      json: { error: "Ya hay una ejecución activa. Espera o cancélala." },
    }),
  );
  await reviewCheck(page);
  await launchWithCredentials(page);
  await expect(
    page.getByText("Ya hay una ejecución activa. Espera o cancélala."),
  ).toBeVisible();
  await expect(page.locator("#nav-execution")).toBeDisabled();
  await expect(page.locator('[data-step="review"]')).toBeVisible();
  expect(calls.errors).toEqual([]);
});

test("discovers the detected local network without entering a range", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.locator("#nav-equipment").click();
  await expect(page.locator("#local_network")).toContainText("192.168.1.0/24");
  await expect(page.locator("#cidr")).not.toBeVisible();
  await page.locator("#discover").click();
  await expect(page.getByText("192.168.1.20", { exact: true })).toBeVisible();
  expect(calls.discoveries).toEqual([
    { network: "eth0:192.168.1.5/24", port: 2222 },
  ]);
  await expect(page.locator("#nav-recipes")).toBeEnabled();
  expect(calls.errors).toEqual([]);
});

test("manual range works when no local network is detected", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.route("http://aula.test/api/networks", (route) =>
    route.fulfill({
      status: 400,
      json: {
        error:
          "No se detectó una red local IPv4 activa. Conecta este equipo por cable o Wi-Fi y vuelve a intentarlo.",
      },
    }),
  );
  await page.locator("#nav-equipment").click();
  await expect(page.locator("#cidr")).toBeVisible();
  await expect(page.locator("#discover")).toBeDisabled();
  await page.locator("#cidr").fill("192.168.2.0/24");
  await page.locator("#discover_manual").click();
  await expect(page.getByText("192.168.1.20", { exact: true })).toBeVisible();
  expect(calls.discoveries).toEqual([{ cidr: "192.168.2.0/24", port: 2222 }]);
  expect(calls.errors).toEqual([]);
});
test("empty discovery reveals the manual range fallback", async ({ page }) => {
  await setup(page);
  await page.route("http://aula.test/api/discover", (route) =>
    route.fulfill({ json: { hosts: [] } }),
  );
  await page.locator("#nav-equipment").click();
  await expect(page.locator("#discover")).toBeEnabled();
  await page.locator("#discover").click();
  await expect(page.locator("#cidr")).toBeVisible();
  await expect(page.locator("#nav-recipes")).toBeDisabled();
});

test("global variables become wizard defaults and allow per-run edits", async ({
  page,
}) => {
  const calls = await setup(page, { hosts: ["192.168.1.2"] });
  await page.locator("#nav-globals").click();
  await page
    .locator("#global_variables")
    .fill("aula_user: estudiante\naula_jdk: '25'\n");
  await page.locator("#save_globals").click();
  await expect(
    page.getByText(
      "Variables guardadas y aplicadas como valores predeterminados.",
    ),
  ).toBeVisible();
  expect(calls.globals).toHaveLength(1);
  await openRecipes(page);
  await page.locator("#recipe-java").check();
  await page.locator("#recipe-user").check();
  await page.locator("#to_parameters").click();
  await expect(page.locator("#target_user")).toHaveValue("estudiante");
  await expect(page.locator("#jdk")).toHaveValue("25");
  await page.locator("#jdk").fill("21");
  await page.locator("#to_selection").click();
  await page.locator("#to_parameters").click();
  await expect(page.locator("#jdk")).toHaveValue("21");
  expect(calls.errors).toEqual([]);
});

test("an outdated backend explains missing globals instead of showing an empty editor", async ({
  page,
}) => {
  await page.route("http://aula.test/api/globals", (route) =>
    route.fulfill({ status: 404, json: { error: "No encontrado" } }),
  );
  // setup registers its general handler last; add the specific override before navigation via a delayed reload.
  await setup(page);
  await page.route("http://aula.test/api/globals", (route) =>
    route.fulfill({ status: 404, json: { error: "No encontrado" } }),
  );
  await page.reload();
  await page.locator("#nav-globals").click();
  await expect(
    page.getByText(
      "El servidor está desactualizado. Reinicia Aula Ansible y pulsa Recargar variables.",
    ),
  ).toBeVisible();
  await expect(page.locator("#global_variables")).toHaveCount(0);
});

test("credentials popup defers execution and clears password on cancel", async ({
  page,
}) => {
  const calls = await setup(page, { hosts: ["192.168.1.2"] });
  await reviewCheck(page);
  await page.locator("#confirm").click();
  await page.locator("#launch_ssh_password").fill("discarded-secret");
  expect(calls.runs).toHaveLength(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar" })
    .click();
  await expect(page.locator("#launch_ssh_password")).toHaveCount(0);
  await page.locator("#confirm").click();
  await expect(page.locator("#launch_ssh_password")).toHaveValue("");
  await page.locator("#launch_ssh_user").fill("ma.madridrodriguez");
  await page.locator("#launch_ssh_password").fill("fake-test-secret");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ejecutar ahora" })
    .click();
  await expect(page.locator("#status")).toHaveText("Completada");
  expect(calls.runs[0].ssh_user).toBe("ma.madridrodriguez");
  expect(calls.runs[0].ssh_password).toBe("fake-test-secret");
  expect(calls.runs[0].sudo_password).toBe("fake-test-secret");
});

test("selected files and destination folder are sent when launching", async ({
  page,
}) => {
  const calls = await setup(page, { hosts: ["192.168.1.2"] });
  await openRecipes(page);
  await page.locator("#recipe-folders").check();
  await page.locator("#to_parameters").click();
  await page.locator("#selected_files").setInputFiles([
    {
      name: "ejercicio.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("contenido"),
    },
    {
      name: "quitar.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("descartado"),
    },
  ]);
  await page
    .getByRole("button", { name: "Quitar quitar.txt", exact: true })
    .click();
  await page.locator("#destination_folder").fill("Tema 1");
  await page.locator("#run").click();
  await expect(page.getByText("Tema 1", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Se eliminarán todas las carpetas existentes del escritorio y su contenido antes de copiar. Esta operación no tiene deshacer.",
      { exact: true },
    ),
  ).toBeVisible();
  await launchWithCredentials(page);
  await expect(page.locator("#status")).toHaveText("Completada");
  expect(calls.runs[0].destination_folder).toBe("Tema 1");
  expect(calls.runs[0].files).toEqual([
    {
      name: "ejercicio.txt",
      content: Buffer.from("contenido").toString("base64"),
    },
  ]);
});

test("recipe arrows change the order sent to the server", async ({ page }) => {
  const calls = await setup(page, { hosts: ["192.168.1.2"] });
  await openRecipes(page);
  await page.locator("#recipe-java").check();
  await page.locator("#recipe-vscode").check();
  await page
    .getByRole("button", {
      name: "Subir Instalación y configuración de VS Code",
      exact: true,
    })
    .click();
  expect(
    await page
      .getByTestId("recipe-order")
      .locator("li")
      .evaluateAll((items) => items.map((item) => item.dataset.recipeId)),
  ).toEqual(["check", "vscode", "java"]);
  await page.locator("#to_parameters").click();
  await page.locator("#run").click();
  await launchWithCredentials(page);
  await expect(page.locator("#status")).toHaveText("Completada");
  expect(calls.runs[0].recipes).toEqual(["check", "vscode", "java"]);
});

test("bundled catalogue shows imported recipes with only required parameters", async ({
  page,
}) => {
  const catalogue = fs
    .readdirSync(path.resolve("../recipes"))
    .filter((name) => name.endsWith(".json"))
    .map((name) =>
      JSON.parse(fs.readFileSync(path.resolve("../recipes", name), "utf8")),
    );
  const mongo = catalogue.find(
    (recipe) => recipe.source === "4_instalacion_mongo.yml",
  );
  const xampp = catalogue.find((recipe) => recipe.requires_account);
  await setup(page, { hosts: ["192.168.1.2"], catalogue });
  await openRecipes(page);
  for (const recipe of catalogue)
    await expect(page.locator("#recipe-" + recipe.id)).toBeVisible();
  await page.locator("#recipe-" + mongo.id).check();
  await page.locator("#to_parameters").click();
  await expect(page.locator("#target_user")).toHaveCount(0);
  await expect(page.locator("#jdk")).toHaveCount(0);
  await expect(page.locator("#settings")).toHaveCount(0);
  await page.locator("#to_selection").click();
  await page.locator("#recipe-" + xampp.id).check();
  await page.locator("#to_parameters").click();
  await expect(page.locator("#target_user")).toBeVisible();
  await expect(page.locator("#jdk")).toHaveCount(0);
});

test("account creation can disable sudo and sends the choice", async ({
  page,
}) => {
  const calls = await setup(page, { hosts: ["192.168.1.2"] });
  await openRecipes(page);
  await page.locator("#recipe-user").check();
  await page.locator("#to_parameters").click();
  await expect(page.locator("#user_sudo")).toBeChecked();
  await page.locator("#user_sudo").uncheck();
  await page.locator("#target_user").fill("examenPRG");
  await page.locator("#target_password").fill("example-account-test-only");
  await page.locator("#run").click();
  await launchWithCredentials(page);
  await expect(page.locator("#status")).toHaveText("Completada");
  expect(calls.runs[0].user_sudo).toBe(false);
});

test("running jobs show per-PC task counts, skipped tasks and current task", async ({
  page,
}) => {
  const progress = {
    "192.168.1.2": {
      completed: 3,
      total: 12,
      estimated: true,
      skipped: 1,
      current_task: "Descargar Temurin",
    },
    "192.168.1.3": {
      completed: 1,
      total: 12,
      estimated: true,
      skipped: 0,
      current_task: "Comprobar permisos",
    },
  };
  await setup(page, {
    hosts: ["192.168.1.2", "192.168.1.3"],
    jobStatus: "running",
    progress,
  });
  await reviewCheck(page);
  await launchWithCredentials(page);
  await expect(page.getByTestId("task-count-192.168.1.2")).toHaveText(
    "3 / ≈12 tareas · 1 omitida",
  );
  await expect(page.getByTestId("task-count-192.168.1.3")).toHaveText(
    "1 / ≈12 tareas",
  );
  await expect(
    page.getByText("En curso: Descargar Temurin", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", {
      name: "Avance de tareas 192.168.1.2",
      exact: true,
    }),
  ).toHaveAttribute("aria-valuenow", "25");
});
