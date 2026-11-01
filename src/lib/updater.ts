import { isTauri } from "../api/proxyClient";

/** Selbst-Update gibt es nur in der Desktop-App, nicht im Browser und nicht unter Android. */
export function canSelfUpdate(): boolean {
  return isTauri() && !/Android/i.test(navigator.userAgent);
}

export interface AvailableUpdate {
  version: string;
  notes?: string;
  install: () => Promise<void>;
}

/** Fragt den Update-Server; `null`, wenn die App aktuell ist. */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!canSelfUpdate()) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    notes: update.body,
    install: async () => {
      await update.downloadAndInstall();
      // Unter Windows beendet der Installer die App meist selbst; sonst neu starten.
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}

export async function appVersion(): Promise<string | null> {
  if (!isTauri()) return null;
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}
