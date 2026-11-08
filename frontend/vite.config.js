import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "local-session-token",
      async transformIndexHtml(html, context) {
        if (!context.server) return html;
        const response = await fetch("http://127.0.0.1:8765/");
        if (!response.ok)
          throw Error("Inicia app.py antes de usar el servidor de desarrollo.");
        const backend = await response.text();
        const token = backend.match(
          /name="aula-token" content="([a-f0-9]+|[A-Za-z0-9_-]+)"/,
        );
        if (!token) throw Error("No se pudo leer el token local de app.py.");
        return html
          .replace("__TOKEN__", token[1])
          .replace("__MODE__", "application");
      },
    },
  ],
  resolve: { alias: { "@": path.resolve(root, "./src") } },
  build: { outDir: "../web/dist", emptyOutDir: true },
  server: {
    host: "127.0.0.1",
    proxy: { "/api": { target: "http://127.0.0.1:8765", changeOrigin: true } },
  },
});
