import { ApiError } from "./errors";
import { httpJson } from "./http";

const BASE = "https://pc-launcher-sdk-api.kurogame.net/game";

interface KuroEnvelope {
  code?: number;
  msg?: string;
  data?: Record<string, unknown> | null;
}

function mapCode(code: number, msg: string): ApiError {
  if (code === 1001) return new ApiError("auth", msg || "invalid token", code);
  if (code === 1005) return new ApiError("retry", msg || "retrying", code);
  return new ApiError("unknown", `${msg || "Fehler"} (code ${code})`, code);
}

async function post(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<KuroEnvelope> {
  const json = (await httpJson({
    url: `${BASE}/${endpoint}?_t=${Math.floor(Date.now() / 1000)}`,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })) as KuroEnvelope;
  if (typeof json?.code !== "number") throw new ApiError("schema", "Antwort ohne code");
  if (json.code !== 0) throw mapCode(json.code, json.msg ?? "");
  return json;
}

export interface KuroPlayer {
  playerId: string;
  region: string;
}

function parseMaybeJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

/** Die Feldnamen in queryPlayerInfo sind nicht dokumentiert, daher tolerant suchen. */
export function findPlayerId(v: unknown): string | undefined {
  const o = parseMaybeJson(v);
  if (typeof o === "number") return String(o);
  if (typeof o === "string" && /^\d+$/.test(o)) return o;
  if (o && typeof o === "object") {
    const entries = Object.entries(o as Record<string, unknown>);
    for (const [k, val] of entries) {
      if (/^(player_?id|id|uid)$/i.test(k) && (typeof val === "string" || typeof val === "number")) {
        return String(val);
      }
    }
    for (const [, val] of entries) {
      const nested = findPlayerId(val);
      if (nested) return nested;
    }
  }
  return undefined;
}

/** Schritt 1: Server und Spieler-ID zum oauthCode (nur beim Anlegen des Profils). */
export async function queryPlayerInfo(
  oauthCode: string,
  signal?: AbortSignal,
): Promise<KuroPlayer> {
  const json = await post("queryPlayerInfo", { oauthCode }, signal);
  const data = json.data ?? {};
  for (const region of Object.keys(data)) {
    const id = findPlayerId(data[region]);
    if (id) return { region, playerId: id };
  }
  throw new ApiError("schema", "Keine Spieler-ID in queryPlayerInfo gefunden");
}

/** Schritt 2: Live-Werte. `data.<region>` ist ein JSON-String und wird ein zweites Mal geparst. */
export async function queryRole(
  oauthCode: string,
  player: KuroPlayer,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const attempts = 3;
  for (let i = 0; ; i++) {
    try {
      const json = await post(
        "queryRole",
        { oauthCode, playerId: player.playerId, region: player.region },
        signal,
      );
      const parsed = parseMaybeJson(json.data?.[player.region]);
      if (!parsed || typeof parsed !== "object") {
        throw new ApiError("schema", "queryRole ohne Daten");
      }
      return parsed as Record<string, unknown>;
    } catch (e) {
      if (e instanceof ApiError && e.kind === "retry" && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw e;
    }
  }
}
