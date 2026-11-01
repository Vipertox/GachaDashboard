import { isTauri, proxyFetch } from "../api/proxyClient";

/**
 * Einziger Zugriff auf den sicheren Speicher. Ein Wechsel des Keystore-Plugins
 * betrifft nur diese Datei.
 *   Tauri:   tauri-plugin-secure-keystore (Credential Manager / Android Keystore)
 *   Browser: OS-Schlüsselspeicher des lokalen Proxys
 */

export type SecretName = "ltuid_v2" | "ltoken_v2" | "kuro_oauth";

const key = (profileId: string, name: SecretName) => `${profileId}/${name}`;

async function getItem(k: string): Promise<string | null> {
  if (isTauri()) {
    const ks = await import("tauri-plugin-secure-keystore");
    return ks.getItem(k);
  }
  const res = await proxyFetch(`/api/credentials/${k}`);
  if (!res.ok) throw new Error(`Schlüsselspeicher: HTTP ${res.status}`);
  return ((await res.json()) as { value: string | null }).value;
}

async function setItem(k: string, value: string): Promise<void> {
  if (isTauri()) {
    const ks = await import("tauri-plugin-secure-keystore");
    return ks.setItem(k, value);
  }
  const res = await proxyFetch(`/api/credentials/${k}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error(`Schlüsselspeicher: HTTP ${res.status}`);
}

async function deleteItem(k: string): Promise<void> {
  if (isTauri()) {
    const ks = await import("tauri-plugin-secure-keystore");
    return ks.deleteItem(k);
  }
  const res = await proxyFetch(`/api/credentials/${k}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Schlüsselspeicher: HTTP ${res.status}`);
}

export interface ProfileSecrets {
  ltuid: string;
  ltoken: string;
  kuroOauth: string;
}

export async function loadSecrets(profileId: string): Promise<ProfileSecrets> {
  const [ltuid, ltoken, kuro] = await Promise.all([
    getItem(key(profileId, "ltuid_v2")),
    getItem(key(profileId, "ltoken_v2")),
    getItem(key(profileId, "kuro_oauth")),
  ]);
  return { ltuid: ltuid ?? "", ltoken: ltoken ?? "", kuroOauth: kuro ?? "" };
}

async function put(profileId: string, name: SecretName, value: string) {
  if (value) await setItem(key(profileId, name), value);
  else await deleteItem(key(profileId, name));
}

export async function saveSecrets(profileId: string, s: ProfileSecrets): Promise<void> {
  await Promise.all([
    put(profileId, "ltuid_v2", s.ltuid),
    put(profileId, "ltoken_v2", s.ltoken),
    put(profileId, "kuro_oauth", s.kuroOauth),
  ]);
}

export async function deleteSecrets(profileId: string): Promise<void> {
  await Promise.all([
    deleteItem(key(profileId, "ltuid_v2")),
    deleteItem(key(profileId, "ltoken_v2")),
    deleteItem(key(profileId, "kuro_oauth")),
  ]);
}
