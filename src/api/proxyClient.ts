import { ApiError } from "./errors";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function proxyToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="proxy-token"]')?.content ?? "";
}

/** Aufruf des lokalen Proxys (nur Browser-Modus). */
export async function proxyFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = proxyToken();
  if (!token || token.startsWith("__")) {
    throw new ApiError(
      "network",
      "Lokaler Proxy nicht erreichbar (kein Token). Mit `npm run dev` oder `npm start` starten.",
    );
  }
  const headers = new Headers(init.headers);
  headers.set("x-proxy-token", token);
  try {
    return await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError("network", "Lokaler Proxy nicht erreichbar");
  }
}
