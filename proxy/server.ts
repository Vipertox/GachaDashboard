import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Entry } from "@napi-rs/keyring";
import { Hono, type Context } from "hono";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const RUNTIME = join(ROOT, "proxy", ".runtime");
const SETTINGS_FILE = join(RUNTIME, "settings.json");
const PORT = Number(process.env.PROXY_PORT ?? 8787);
const KEYRING_SERVICE = "GachaDashboard";

/** Nur diese Hosts darf der Proxy ansprechen. */
export const ALLOWED_HOSTS = new Set([
  "bbs-api-os.hoyolab.com",
  "sg-act-nap-api.hoyolab.com",
  "api-account-os.hoyolab.com",
  "pc-launcher-sdk-api.kurogame.net",
]);

export const KEY_PATTERN = /^[A-Za-z0-9_\-/.]{1,128}$/;

export function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

/** Gegen DNS-Rebinding: Anfragen müssen an localhost/127.0.0.1 gerichtet sein. */
export function isLocalHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.replace(/:\d+$/, "");
  return host === "127.0.0.1" || host === "localhost";
}

export function tokenMatches(expected: string, given: string | undefined): boolean {
  if (!given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp(token: string): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    if (!isLocalHost(c.req.header("host"))) return c.text("Forbidden", 403);
    await next();
  });

  const api = new Hono();
  api.use("*", async (c, next) => {
    if (!tokenMatches(token, c.req.header("x-proxy-token"))) return c.text("Unauthorized", 401);
    const origin = c.req.header("origin");
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      return c.text("Forbidden", 403);
    }
    await next();
  });

  api.post("/fetch", async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      url?: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    } | null;
    if (!body?.url || !isAllowedUrl(body.url)) return c.text("Host nicht erlaubt", 400);
    const method = body.method === "POST" ? "POST" : "GET";
    try {
      const res = await fetch(body.url, {
        method,
        headers: body.headers,
        body: method === "POST" ? body.body : undefined,
        redirect: "manual",
      });
      return c.json({ status: res.status, text: await res.text() });
    } catch (e) {
      return c.text(`Upstream-Fehler: ${e instanceof Error ? e.message : "unbekannt"}`, 502);
    }
  });

  const keyOf = (c: Context): string | null => {
    const key = c.req.param("key") ?? "";
    return KEY_PATTERN.test(key) ? key : null;
  };

  // Tokens liegen im OS-Schlüsselspeicher, nie in einer Datei.
  api.get("/credentials/:key{.+}", (c) => {
    const key = keyOf(c);
    if (!key) return c.text("Ungültiger Schlüssel", 400);
    return c.json({ value: new Entry(KEYRING_SERVICE, key).getPassword() });
  });
  api.put("/credentials/:key{.+}", async (c) => {
    const key = keyOf(c);
    const body = (await c.req.json().catch(() => null)) as { value?: string } | null;
    if (!key || typeof body?.value !== "string") return c.text("Ungültige Anfrage", 400);
    new Entry(KEYRING_SERVICE, key).setPassword(body.value);
    return c.json({ ok: true });
  });
  api.delete("/credentials/:key{.+}", (c) => {
    const key = keyOf(c);
    if (!key) return c.text("Ungültiger Schlüssel", 400);
    try {
      new Entry(KEYRING_SERVICE, key).deletePassword();
    } catch {
      // nichts gespeichert
    }
    return c.json({ ok: true });
  });

  // Profil-Einstellungen: keine Tokens, keine Spieldaten.
  api.get("/settings", (c) => {
    if (!existsSync(SETTINGS_FILE)) return c.json({});
    return c.body(readFileSync(SETTINGS_FILE, "utf8"), 200, { "content-type": "application/json" });
  });
  api.put("/settings", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return c.text("Ungültige Anfrage", 400);
    mkdirSync(RUNTIME, { recursive: true });
    writeFileSync(SETTINGS_FILE, JSON.stringify(body, null, 2), "utf8");
    return c.json({ ok: true });
  });

  app.route("/api", api);

  const MIME: Record<string, string> = {
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".png": "image/png",
    ".json": "application/json",
  };

  app.get("*", (c) => {
    const path = c.req.path === "/" ? "/index.html" : c.req.path;
    const file = resolve(DIST, "." + path);
    if (path !== "/index.html" && file.startsWith(DIST) && existsSync(file)) {
      return c.body(readFileSync(file), 200, {
        "content-type": MIME[extname(file)] ?? "application/octet-stream",
      });
    }
    const indexFile = join(DIST, "index.html");
    if (!existsSync(indexFile)) return c.text("Kein Build vorhanden. `npm run start` baut und startet.", 404);
    const html = readFileSync(indexFile, "utf8").replace("__PROXY_TOKEN__", token);
    return c.html(html);
  });

  return app;
}

function main() {
  const token = randomBytes(24).toString("hex");
  mkdirSync(RUNTIME, { recursive: true });
  writeFileSync(join(RUNTIME, "token"), token, "utf8");
  serve({ fetch: createApp(token).fetch, hostname: "127.0.0.1", port: PORT }, (info) => {
    console.log(`Proxy lauscht auf http://127.0.0.1:${info.port}`);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
