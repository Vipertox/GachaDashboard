import { z } from "zod";
import { fetchWithCredentials } from "../adapters/credentialsForAccount";
import { optNum, parseOrThrow } from "../adapters/util";
import { plain, unixDate } from "../challenges/util";
import { optStr, str } from "../characters/util";
import { hoyoGet } from "../hoyolab";
import { bannerStatus, eventStatus, isCurrent, rarity, toRarity } from "./util";
import type { Banner, BannerKind, EventAdapter, GameEvent } from "../../model/types";

const BASE = "https://sg-act-nap-api.hoyolab.com/event/game_record_zzz/api/zzz";

const activitySchema = z.object({
  activity_list: z
    .array(
      z.object({
        activity_id: str,
        name: str,
        state: optStr,
        start_ts: optNum,
        end_ts: optNum,
        monochrome_got_cnt: optNum,
        monochrome_cnt: optNum,
      }),
    )
    .optional()
    .nullable(),
});

/** ZZZ liefert weder Beschreibung noch Belohnungen, dafür die erreichbaren Polychrome. */
export function parseZzzEvents(data: unknown, now = new Date()): GameEvent[] {
  return (parseOrThrow(activitySchema, data).activity_list ?? [])
    .map((a): GameEvent => {
      const start = unixDate(a.start_ts);
      const e: GameEvent = {
        id: a.activity_id,
        name: plain(a.name),
        start,
        end: unixDate(a.end_ts),
        status: a.state === "STATE_NOT_START" ? "upcoming" : eventStatus(start, a.state === "STATE_COMPLETED", now),
        rewards: [],
      };
      if (a.monochrome_cnt) {
        const got = a.monochrome_got_cnt ?? 0;
        e.progress = { current: got, max: a.monochrome_cnt, unit: "Polychrome" };
        // Anders als Genshin und Star Rail meldet ZZZ genau, wie viel schon eingesammelt ist.
        e.currency = { name: "Polychrome", total: a.monochrome_cnt, remaining: Math.max(0, a.monochrome_cnt - got) };
      }
      return e;
    })
    .filter((e) => isCurrent(e, now));
}

const schedule = z.object({
  gacha_type: optStr,
  version: optStr,
  start_ts: optNum,
  end_ts: optNum,
  avatar_list: z
    .array(z.object({ avatar_name: optStr, full_name: optStr, icon: optStr, rarity }))
    .optional()
    .nullable(),
  // Name der W-Engine nach genshin.py nicht belegt, daher mehrere Kandidaten.
  weapon_list: z
    .array(z.object({ name: optStr, weapon_name: optStr, icon: optStr, rarity }))
    .optional()
    .nullable(),
});

const gachaSchema = z.object({
  avatar_gacha_schedule_list: z.array(schedule).optional().nullable(),
  weapon_gacha_schedule_list: z.array(schedule).optional().nullable(),
});

const CHANNEL: Record<string, { name: string; kind: BannerKind }> = {
  GACHA_TYPE_CHARACTER_UP: { name: "Exklusiver Kanal", kind: "character" },
  GACHA_TYPE_CHARACTER_RETURN: { name: "Exklusive Wiederholung", kind: "character" },
  GACHA_TYPE_WEAPON_UP: { name: "W-Engine-Kanal", kind: "weapon" },
  GACHA_TYPE_WEAPON_RETURN: { name: "W-Engine-Wiederholung", kind: "weapon" },
  GACHA_TYPE_BANGBOO: { name: "Bangboo-Kanal", kind: "other" },
};

export function parseZzzBanners(data: unknown, now = new Date()): Banner[] {
  const d = parseOrThrow(gachaSchema, data);
  // Unbekannte Kanaltypen ordnen sich nach ihrer Liste ein.
  const fromList = (kind: BannerKind) => (s: z.infer<typeof schedule>) => ({ s, kind });
  return [
    ...(d.avatar_gacha_schedule_list ?? []).map(fromList("character")),
    ...(d.weapon_gacha_schedule_list ?? []).map(fromList("weapon")),
  ]
    .map(({ s, kind }, i): Banner => {
      const start = unixDate(s.start_ts);
      const channel = CHANNEL[s.gacha_type ?? ""];
      return {
        id: `${s.gacha_type ?? "gacha"}-${s.start_ts ?? i}-${i}`,
        name: channel?.name ?? "Kanal",
        kind: channel?.kind ?? kind,
        version: s.version || undefined,
        start,
        end: unixDate(s.end_ts),
        status: bannerStatus(start, now),
        items: [
          ...(s.avatar_list ?? []).map((a) => ({ name: a.full_name || a.avatar_name, icon: a.icon, rarity: a.rarity })),
          ...(s.weapon_list ?? []).map((w) => ({ name: w.name || w.weapon_name, icon: w.icon, rarity: w.rarity })),
        ].map((x) => ({ name: plain(x.name) || "W-Engine", iconUrl: x.icon ?? undefined, rarity: toRarity(x.rarity) })),
      };
    })
    .filter((b) => isCurrent(b, now));
}

export const zzzEvents: EventAdapter = {
  game: "zzz",
  // Events und Kanäle sind zwei Endpunkte; die Kanäle sind nur Beiwerk und dürfen fehlen.
  fetchCalendar: (account, signal) =>
    fetchWithCredentials(account, async (creds) => {
      const q = `uid=${account.uid}&region=${account.region}`;
      const [events, gacha] = await Promise.all([
        hoyoGet(`${BASE}/activity_calendar?${q}`, creds, signal),
        hoyoGet(`${BASE}/gacha_calendar?${q}`, creds, signal).catch(() => null),
      ]);
      return { events: parseZzzEvents(events), banners: gacha ? parseZzzBanners(gacha) : [] };
    }),
};
