import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { AsyncEntry } from "@napi-rs/keyring";
import { Hono, type Context } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { hoyolabBrowserLogin } from "./login";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const RUNTIME = join(ROOT, "proxy", ".runtime");
const SETTINGS_FILE = join(RUNTIME, "settings.json");
const PORT = Number(process.env.PROXY_PORT ?? 8787);
const KEYRING_SERVICE = "GachaDashboard";

const UPSTREAM_TIMEOUT_MS = 20_000;

/**
 * Token und Profile nur für den eigenen Benutzer lesbar. Geschrieben wird in eine
 * Temp-Datei und dann umbenannt, damit ein Abbruch keine halbe Datei hinterlässt.
 * Rechte wirken unter Linux/macOS; unter Windows setzt Node damit nur das
 * Schreibschutz-Attribut, dort schützen die Rechte des Benutzerordners.
 */
export function writePrivateFile(file: string, content: string): void {
  const temp = `${file}.tmp`;
  writeFileSync(temp, content, { encoding: "utf8", mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, file);
}

/** Nur diese Hosts darf der Proxy ansprechen. */
export const ALLOWED_HOSTS = new Set([
  "bbs-api-os.hoyolab.com",
  "sg-act-nap-api.hoyolab.com",
  "api-account-os.hoyolab.com",
  "pc-launcher-sdk-api.kurogame.net",
  "wutheringwaves.fandom.com",
  // Countdown: offizielle Ankündigungen und Versionsseiten der Wikis
  "sg-hk4e-api.hoyoverse.com",
  "sg-hkrpg-api.hoyoverse.com",
  "hw-media-cdn-mingchao.kurogame.com",
  "genshin-impact.fandom.com",
  "honkai-star-rail.fandom.com",
  "zenless-zone-zero.fandom.com",
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

  // Gleiche Grenzen wie die CSP der Tauri-App; externe Daten laufen nur über /api/fetch.
  // Verbietet zudem das Einbetten in fremde Seiten (Clickjacking).
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
      xFrameOptions: "DENY",
      // Läuft nur über http auf 127.0.0.1; HSTS wäre dort wirkungslos.
      strictTransportSecurity: false,
    }),
  );

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
        // Hängt der Upstream, endet die Anfrage; bricht die Seite ab, wird das weitergereicht.
        signal: AbortSignal.any([AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), c.req.raw.signal]),
      });
      return c.json({ status: res.status, text: await res.text() });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        return c.text(`Upstream antwortet nicht innerhalb von ${UPSTREAM_TIMEOUT_MS / 1000} s`, 504);
      }
      return c.text(`Upstream-Fehler: ${e instanceof Error ? e.message : "unbekannt"}`, 502);
    }
  });

  api.post("/hoyolab-login", async (c) => {
    try {
      return c.json(await hoyolabBrowserLogin());
    } catch (e) {
      return c.text(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen", 500);
    }
  });

  const keyOf = (c: Context): string | null => {
    const key = c.req.param("key") ?? "";
    return KEY_PATTERN.test(key) ? key : null;
  };

  // Tokens liegen im OS-Schlüsselspeicher, nie in einer Datei. Asynchron, damit eine
  // Freigabe-Abfrage des Schlüsselbunds (macOS) nicht den ganzen Proxy blockiert.
  const keyringError = (c: Context, e: unknown) =>
    c.text(`Schlüsselspeicher: ${e instanceof Error ? e.message : "unbekannter Fehler"}`, 500);

  api.get("/credentials/:key{.+}", async (c) => {
    const key = keyOf(c);
    if (!key) return c.text("Ungültiger Schlüssel", 400);
    try {
      return c.json({ value: await new AsyncEntry(KEYRING_SERVICE, key).getPassword() });
    } catch (e) {
      return keyringError(c, e);
    }
  });
  api.put("/credentials/:key{.+}", async (c) => {
    const key = keyOf(c);
    const body = (await c.req.json().catch(() => null)) as { value?: string } | null;
    if (!key || typeof body?.value !== "string") return c.text("Ungültige Anfrage", 400);
    try {
      await new AsyncEntry(KEYRING_SERVICE, key).setPassword(body.value);
    } catch (e) {
      return keyringError(c, e);
    }
    return c.json({ ok: true });
  });
  api.delete("/credentials/:key{.+}", async (c) => {
    const key = keyOf(c);
    if (!key) return c.text("Ungültiger Schlüssel", 400);
    try {
      await new AsyncEntry(KEYRING_SERVICE, key).deletePassword();
    } catch {
      // nichts gespeichert
    }
    return c.json({ ok: true });
  });

  // Profil-Einstellungen: keine Tokens, keine Spieldaten.
  api.get("/settings", (c) => {
    if (!existsSync(SETTINGS_FILE)) return c.json({});
    const raw = readFileSync(SETTINGS_FILE, "utf8");
    try {
      JSON.parse(raw);
    } catch {
      // Nicht still als leer behandeln: das nächste Speichern würde die Profile überschreiben.
      return c.text(`Einstellungsdatei ist beschädigt: ${SETTINGS_FILE}`, 500);
    }
    return c.body(raw, 200, { "content-type": "application/json" });
  });
  api.put("/settings", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return c.text("Ungültige Anfrage", 400);
    mkdirSync(RUNTIME, { recursive: true });
    writePrivateFile(SETTINGS_FILE, JSON.stringify(body, null, 2));
    return c.json({ ok: true });
  });

  app.route("/api", api);

  const MIME: Record<string, string> = {
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".json": "application/json",
  };

  app.get("*", (c) => {
    const path = c.req.path === "/" ? "/index.html" : c.req.path;
    const file = resolve(DIST, "." + path);
    const isAsset = file.startsWith(DIST + sep) && existsSync(file) && statSync(file).isFile();
    if (path !== "/index.html" && isAsset) {
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
  writePrivateFile(join(RUNTIME, "token"), token);
  serve({ fetch: createApp(token).fetch, hostname: "127.0.0.1", port: PORT }, (info) => {
    console.log(`Proxy lauscht auf http://127.0.0.1:${info.port}`);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
