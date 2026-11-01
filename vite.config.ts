import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vitest/config";

const PROXY_PORT = Number(process.env.PROXY_PORT ?? 8787);

// Im Dev-Modus liefert Vite die Seite aus. Das Zufallstoken des Proxys wird
// aus dessen Token-Datei in die Seite eingesetzt, genau wie im Produktivbetrieb.
function proxyToken(): Plugin {
  return {
    name: "proxy-token",
    apply: "serve",
    transformIndexHtml(html) {
      let token = "";
      try {
        token = readFileSync(resolve(import.meta.dirname, "proxy/.runtime/token"), "utf8").trim();
      } catch {
        // Proxy noch nicht gestartet: Seite laedt, Aufrufe schlagen mit Hinweis fehl.
      }
      return html.replace("__PROXY_TOKEN__", token);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), proxyToken()],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${PROXY_PORT}` },
  },
  test: { environment: "node", include: ["src/**/*.test.ts", "proxy/**/*.test.ts"] },
});
