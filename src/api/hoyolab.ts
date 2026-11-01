import { md5 } from "js-md5";
import { ApiError } from "./errors";
import { httpJson } from "./http";
import type { GameId } from "../model/types";

const OVERSEAS_SALT = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";

function randomString(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function generateDs(now = Math.floor(Date.now() / 1000), random = randomString(6)): string {
  const hash = md5(`salt=${OVERSEAS_SALT}&t=${now}&r=${random}`);
  return `${now},${random},${hash}`;
}

export interface HoyoCredentials {
  ltuid: string;
  ltoken: string;
}

export function hoyoHeaders(c: HoyoCredentials): Record<string, string> {
  return {
    Cookie: `ltuid_v2=${c.ltuid}; ltoken_v2=${c.ltoken}`,
    DS: generateDs(),
    "x-rpc-app_version": "1.5.0",
    "x-rpc-client_type": "5",
    "x-rpc-language": "de-de",
    Accept: "application/json",
    Origin: "https://act.hoyolab.com",
    Referer: "https://act.hoyolab.com/",
  };
}

export function mapRetcode(retcode: number, message: string): ApiError {
  if (retcode === -100 || retcode === 10001) return new ApiError("auth", message, retcode);
  if (retcode === 10102) return new ApiError("notes_disabled", message, retcode);
  if (retcode === 10101) return new ApiError("rate_limit", message, retcode);
  return new ApiError("unknown", `${message} (retcode ${retcode})`, retcode);
}

/** Ruft einen HoYoLAB-Endpunkt auf und gibt `data` zurück. */
export async function hoyoGet(
  url: string,
  creds: HoyoCredentials,
  signal?: AbortSignal,
): Promise<unknown> {
  const json = (await httpJson({ url, headers: hoyoHeaders(creds), signal })) as {
    retcode?: number;
    message?: string;
    data?: unknown;
  };
  if (typeof json?.retcode !== "number") throw new ApiError("schema", "Antwort ohne retcode");
  if (json.retcode !== 0) throw mapRetcode(json.retcode, json.message ?? "Fehler");
  return json.data;
}

export const GAME_BIZ: Partial<Record<GameId, string>> = {
  genshin: "hk4e_global",
  starrail: "hkrpg_global",
  zzz: "nap_global",
};

export interface GameRole {
  game: GameId;
  uid: string;
  region: string;
  nickname: string;
  level: number;
}

interface RawRole {
  game_biz?: string;
  game_uid?: string | number;
  region?: string;
  nickname?: string;
  level?: number;
}

/** Pro Spiel das erste Konto; mehrere Server je Spiel sind in Version 1 nicht vorgesehen. */
export function pickRoles(list: RawRole[]): GameRole[] {
  const out: GameRole[] = [];
  for (const [game, biz] of Object.entries(GAME_BIZ) as [GameId, string][]) {
    const first = list.find((r) => r.game_biz === biz && r.game_uid && r.region);
    if (first) {
      out.push({
        game,
        uid: String(first.game_uid),
        region: first.region!,
        nickname: first.nickname ?? "",
        level: first.level ?? 0,
      });
    }
  }
  return out;
}

/** Alle mit dem HoYoLAB-Konto verknüpften Spielkonten, in einem einzigen Aufruf. */
export async function fetchGameRoles(
  creds: HoyoCredentials,
  signal?: AbortSignal,
): Promise<GameRole[]> {
  const data = (await hoyoGet(
    "https://api-account-os.hoyolab.com/account/binding/api/getUserGameRolesByCookie",
    creds,
    signal,
  )) as { list?: RawRole[] } | null;
  if (!Array.isArray(data?.list)) throw new ApiError("schema", "Schnittstelle geändert: list");
  return pickRoles(data.list);
}
