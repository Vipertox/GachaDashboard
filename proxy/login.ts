import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Browser-Login für HoYoLAB: Der Proxy startet Edge oder Chrome mit einem frischen,
 * temporären Profil und Remote-Debugging nur auf 127.0.0.1, liest nach der Anmeldung
 * `ltuid_v2` und `ltoken_v2` per DevTools-Protokoll aus den Cookies und beendet den
 * Browser samt Profil wieder. Das ersetzt den Webview-Login der App, den es im
 * Browser nicht gibt (Cookies fremder Domains sind für die Seite nicht lesbar).
 */

const LOGIN_URL = "https://www.hoyolab.com/home";
const TIMEOUT_MS = 10 * 60_000;
const CDP_TIMEOUT_MS = 5_000;
// Windows gibt das Profilverzeichnis erst nach dem Beenden des Browsers frei.
const PROFILE_CLEANUP_DELAY_MS = 2_000;

export interface HoyoTokens {
  ltuid: string;
  ltoken: string;
}

interface CdpCookie {
  name: string;
  value: string;
  domain: string;
}

export function findBrowser(env = process.env): string | undefined {
  const candidates = [
    env.BROWSER_PATH,
    env["ProgramFiles(x86)"] && join(env["ProgramFiles(x86)"], "Microsoft/Edge/Application/msedge.exe"),
    env.ProgramFiles && join(env.ProgramFiles, "Microsoft/Edge/Application/msedge.exe"),
    env.ProgramFiles && join(env.ProgramFiles, "Google/Chrome/Application/chrome.exe"),
    env["ProgramFiles(x86)"] && join(env["ProgramFiles(x86)"], "Google/Chrome/Application/chrome.exe"),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/microsoft-edge",
  ];
  return candidates.find((c): c is string => !!c && existsSync(c));
}

export function pickTokens(cookies: CdpCookie[]): HoyoTokens | null {
  // Nur hoyolab.com selbst und echte Subdomains, nicht etwa "evilhoyolab.com"
  const hoyo = cookies.filter((c) => /(^|\.)hoyolab\.com$/.test(c.domain));
  const ltuid = hoyo.find((c) => c.name === "ltuid_v2")?.value;
  const ltoken = hoyo.find((c) => c.name === "ltoken_v2")?.value;
  return ltuid && ltoken ? { ltuid, ltoken } : null;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function browserWsUrl(port: number, assertRunning: (message: string) => void): Promise<string> {
  for (let i = 0; i < 50; i++) {
    assertRunning("Browser wurde beendet");
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      return ((await res.json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("Browser-Debugging nicht erreichbar");
}

/**
 * Fragt die Cookies per DevTools-Protokoll ab. Bricht ab, wenn die Verbindung
 * schließt oder der Browser nicht antwortet, damit die Login-Schleife nie hängt.
 */
export function cdpGetCookies(ws: WebSocket, timeoutMs = CDP_TIMEOUT_MS): Promise<CdpCookie[]> {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const cleanup = () => {
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      ws.removeEventListener("close", onDisconnect);
      ws.removeEventListener("error", onDisconnect);
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const onMessage = (ev: MessageEvent) => {
      let msg: { id?: number; result?: { cookies: CdpCookie[] }; error?: { message: string } };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.id !== id) return;
      cleanup();
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result?.cookies ?? []);
    };
    const onDisconnect = () => fail("DevTools-Verbindung wurde getrennt");
    const timer = setTimeout(() => fail("Browser antwortet nicht auf DevTools-Anfrage"), timeoutMs);

    ws.addEventListener("message", onMessage);
    ws.addEventListener("close", onDisconnect);
    ws.addEventListener("error", onDisconnect);
    if (ws.readyState !== WebSocket.OPEN) {
      onDisconnect();
      return;
    }
    ws.send(JSON.stringify({ id, method: "Storage.getCookies" }));
  });
}

/**
 * Löscht das temporäre Profil verzögert. Fehler (etwa EBUSY, solange Hilfsprozesse
 * des Browsers das Verzeichnis halten) dürfen den Proxy nicht beenden.
 */
export function removeProfileLater(dir: string, remove: typeof rmSync = rmSync): void {
  setTimeout(() => {
    try {
      remove(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    } catch (e) {
      console.warn(`Temporäres Browserprofil nicht gelöscht: ${dir} (${e instanceof Error ? e.message : String(e)})`);
    }
  }, PROFILE_CLEANUP_DELAY_MS);
}

let running = false;

export async function hoyolabBrowserLogin(): Promise<HoyoTokens> {
  if (running) throw new Error("Eine Anmeldung läuft bereits");
  const exe = findBrowser();
  if (!exe) throw new Error("Weder Edge noch Chrome gefunden. Pfad mit BROWSER_PATH setzen oder Tokens von Hand eintragen.");

  running = true;
  let dir: string | undefined;
  let child: ChildProcess | undefined;
  let ws: WebSocket | undefined;
  try {
    dir = mkdtempSync(join(tmpdir(), "gacha-login-"));
    const port = await freePort();
    const browser = spawn(
      exe,
      [
        `--remote-debugging-port=${port}`,
        "--remote-debugging-address=127.0.0.1",
        `--user-data-dir=${dir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--new-window",
        LOGIN_URL,
      ],
      { stdio: "ignore" },
    );
    child = browser;
    // Ohne Listener beendet ein fehlgeschlagener Start (z. B. falscher BROWSER_PATH) den Proxy.
    let spawnError: Error | undefined;
    browser.once("error", (e) => {
      spawnError = e;
    });
    const assertRunning = (message: string) => {
      if (spawnError) throw new Error(`Browser konnte nicht gestartet werden: ${spawnError.message}`);
      if (browser.exitCode !== null) throw new Error(message);
    };

    const socket = new WebSocket(await browserWsUrl(port, assertRunning));
    ws = socket;
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve());
      socket.addEventListener("error", () => reject(new Error("DevTools-Verbindung fehlgeschlagen")));
    });
    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(1000);
      assertRunning("Anmeldefenster wurde geschlossen");
      const tokens = pickTokens(await cdpGetCookies(socket));
      if (tokens) return tokens;
    }
    throw new Error("Zeitüberschreitung bei der Anmeldung");
  } finally {
    running = false;
    ws?.close();
    child?.kill();
    if (dir) removeProfileLater(dir);
  }
}
