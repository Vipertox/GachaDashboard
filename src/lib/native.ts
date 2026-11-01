import { isTauri, proxyFetch } from "../api/proxyClient";

/** Nur Windows (Tauri): liest den Kuro-Code aus dem Launcher-Cache. */
export async function readLauncherCode(): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("read_kuro_launcher_code");
}

export function isWindowsApp(): boolean {
  return isTauri() && /Windows/i.test(navigator.userAgent);
}

/**
 * Öffnet die HoYoLAB-Anmeldung und gibt die Tokens zurück.
 * App: Webview mit Cookie-Auslesen. Browser: der lokale Proxy startet Edge/Chrome
 * mit temporärem Profil und liest die Cookies per DevTools-Protokoll.
 */
export async function hoyolabWebviewLogin(): Promise<{ ltuid: string; ltoken: string }> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<{ ltuid: string; ltoken: string }>("hoyolab_webview_login");
  }
  const res = await proxyFetch("/api/hoyolab-login", { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { ltuid: string; ltoken: string };
}

/** App: Systembrowser über das Opener-Plugin (erlaubte URLs in capabilities/default.json). Browser: neuer Tab. */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function haptic(ms = 15): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // nicht unterstützt
  }
}
