import { ApiError } from "./errors";
import { isTauri, proxyFetch } from "./proxyClient";

export interface HttpRequest {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface HttpResponse {
  status: number;
  text: string;
}

/**
 * Einzige Stelle, die zwischen App und Browser unterscheidet:
 * In Tauri läuft der Aufruf über plugin-http, im Browser über den lokalen Proxy.
 */
export async function httpRequest(req: HttpRequest): Promise<HttpResponse> {
  try {
    if (isTauri()) {
      const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
      const res = await tauriFetch(req.url, {
        method: req.method ?? "GET",
        headers: req.headers,
        body: req.body,
        signal: req.signal,
      });
      return { status: res.status, text: await res.text() };
    }
    const res = await proxyFetch("/api/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: req.url,
        method: req.method ?? "GET",
        headers: req.headers,
        body: req.body,
      }),
      signal: req.signal,
    });
    if (!res.ok) throw new ApiError("network", `Proxy-Fehler ${res.status}: ${await res.text()}`);
    return (await res.json()) as HttpResponse;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("network", e instanceof Error ? e.message : "Netzwerkfehler");
  }
}

export async function httpJson(req: HttpRequest): Promise<unknown> {
  const res = await httpRequest(req);
  try {
    return JSON.parse(res.text);
  } catch {
    throw new ApiError("schema", `Keine JSON-Antwort (HTTP ${res.status})`);
  }
}
