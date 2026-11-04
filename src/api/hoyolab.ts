import { md5 } from "js-md5";
import { z } from "zod";
import { optNum, parseOrThrow } from "./adapters/util";
import { ApiError } from "./errors";
import { httpJson } from "./http";
import type { Account, GameId } from "../model/types";

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
  // Während eines Spiel-Updates antwortet die Battle Chronicle mit 10307, bis die Server wieder laufen.
  if (retcode === 10307) return new ApiError("maintenance", "Die Daten erscheinen nach dem Update wieder", retcode);
  return new ApiError("unknown", `${message} (retcode ${retcode})`, retcode);
}

/** Ruft einen HoYoLAB-Endpunkt auf und gibt `data` zurück. */
export function hoyoGet(url: string, creds: HoyoCredentials, signal?: AbortSignal): Promise<unknown> {
  return hoyoRequest(url, creds, undefined, signal);
}

/** Wie `hoyoGet`, aber als POST mit JSON-Body (z. B. Genshin-Figurendetails). */
export function hoyoPost(
  url: string,
  creds: HoyoCredentials,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  return hoyoRequest(url, creds, body, signal);
}

async function hoyoRequest(
  url: string,
  creds: HoyoCredentials,
  body: Record<string, unknown> | undefined,
  signal?: AbortSignal,
): Promise<unknown> {
  const headers = hoyoHeaders(creds);
  const json = await httpJson(
    body
      ? {
          url,
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify(body),
          signal,
        }
      : { url, headers, signal },
  );
  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) throw new ApiError("schema", "Antwort ohne retcode");
  const { retcode, message, data } = envelope.data;
  if (retcode !== 0) throw mapRetcode(retcode, message ?? "Fehler");
  return data;
}

const envelopeSchema = z.object({ retcode: z.number(), message: z.string().nullish(), data: z.unknown() });

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

const roleSchema = z.object({
  game_biz: z.string().nullish(),
  // Text oder Zahl; ein Objekt o. Ä. wäre sonst als "[object Object]" zur UID geworden
  game_uid: z.union([z.string(), z.number()]).nullish(),
  region: z.string().nullish(),
  nickname: z.string().nullish(),
  level: optNum,
});
const rolesSchema = z.object({ list: z.array(roleSchema) });

type RawRole = z.input<typeof roleSchema>;

/** Pro Spiel das erste Konto; mehrere Server je Spiel sind in Version 1 nicht vorgesehen. */
export function pickRoles(list: RawRole[]): GameRole[] {
  const out: GameRole[] = [];
  for (const [game, biz] of Object.entries(GAME_BIZ) as [GameId, string][]) {
    const first = list.find((r) => r.game_biz === biz && r.game_uid && r.region);
    if (first?.game_uid && first.region) {
      out.push({
        game,
        uid: String(first.game_uid),
        region: first.region,
        nickname: first.nickname ?? "",
        level: Number(first.level ?? 0) || 0,
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
  const data = await hoyoGet(
    "https://api-account-os.hoyolab.com/account/binding/api/getUserGameRolesByCookie",
    creds,
    signal,
  );
  return pickRoles(parseOrThrow(rolesSchema, data).list);
}

/** `server` und `role_id` der Spielendpunkte, kodiert. */
export const roleParams = (account: Pick<Account, "uid" | "region">) =>
  new URLSearchParams({ server: account.region, role_id: account.uid }).toString();

/** `uid` und `region` (ZZZ-Kalender und einige ZZZ-Modi), kodiert. */
export const uidParams = (account: Pick<Account, "uid" | "region">) =>
  new URLSearchParams({ uid: account.uid, region: account.region }).toString();
