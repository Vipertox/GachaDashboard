import { isTauri, proxyFetch } from "../api/proxyClient";
import { DEFAULT_SETTINGS, type AppSettings, type ProfileState } from "../model/types";

/**
 * Profil-Einstellungen und App-Einstellungen. Keine Tokens, keine Spieldaten.
 * Tauri: @tauri-apps/plugin-store, Browser: Datei beim lokalen Proxy.
 */

export interface PersistedState {
  profileState: ProfileState;
  settings: AppSettings;
}

const EMPTY: PersistedState = {
  profileState: { profiles: [], activeProfileId: "" },
  settings: DEFAULT_SETTINGS,
};

const STORE_FILE = "settings.json";

export async function loadState(): Promise<PersistedState> {
  let raw: Partial<PersistedState> | undefined;
  if (isTauri()) {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
    raw = {
      profileState: await store.get<ProfileState>("profileState"),
      settings: await store.get<AppSettings>("settings"),
    };
  } else {
    const res = await proxyFetch("/api/settings");
    if (res.ok) raw = (await res.json()) as Partial<PersistedState>;
  }
  return {
    profileState: raw?.profileState ?? EMPTY.profileState,
    settings: { ...DEFAULT_SETTINGS, ...raw?.settings },
  };
}

export async function saveState(state: PersistedState): Promise<void> {
  if (isTauri()) {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
    await store.set("profileState", state.profileState);
    await store.set("settings", state.settings);
    await store.save();
    return;
  }
  const res = await proxyFetch("/api/settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`Einstellungen speichern: HTTP ${res.status}`);
}
