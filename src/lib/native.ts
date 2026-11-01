import { isTauri } from "../api/proxyClient";

export const canUseNative = isTauri;

/** Nur Windows (Tauri): liest den Kuro-Code aus dem Launcher-Cache. */
export async function readLauncherCode(): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("read_kuro_launcher_code");
}

export function isWindowsApp(): boolean {
  return isTauri() && /Windows/i.test(navigator.userAgent);
}

/** Öffnet die HoYoLAB-Anmeldung in einem Webview und gibt die Tokens zurück. */
export async function hoyolabWebviewLogin(): Promise<{ ltuid: string; ltoken: string }> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<{ ltuid: string; ltoken: string }>("hoyolab_webview_login");
}

export function haptic(ms = 15): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // nicht unterstützt
  }
}
