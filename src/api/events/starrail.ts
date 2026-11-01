import { z } from "zod";
import { fetchWithCredentials } from "../adapters/credentialsForAccount";
import { optNum, parseOrThrow } from "../adapters/util";
import { plain, unixDate } from "../challenges/util";
import { optStr, str } from "../characters/util";
import { hoyoGet } from "../hoyolab";
import { bannerStatus, eventStatus, isCurrent, multiline, rarity, toRarity } from "./util";
import type { Banner, EventAdapter, EventCalendar, GameEvent } from "../../model/types";

// Dauerhafte Events haben keinen Zeitraum, `start_ts` ist dann leer oder 0.
const timeInfo = z.object({ start_ts: optNum, end_ts: optNum }).optional().nullable();

const reward = z.object({ name: optStr, icon: optStr, num: optNum });

const act = z.object({
  id: str,
  name: str,
  panel_desc: optStr,
  act_type: optStr,
  act_status: optStr,
  time_info: timeInfo,
  current_progress: optNum,
  total_progress: optNum,
  all_finished: z.boolean().optional(),
  reward_list: z.array(reward).optional().nullable(),
});

const warp = z.object({
  id: str,
  name: optStr,
  time_info: timeInfo,
  avatar_list: z.array(z.object({ item_name: optStr, icon_url: optStr, rarity })).optional().nullable(),
  equip_list: z.array(z.object({ item_name: optStr, item_url: optStr, rarity })).optional().nullable(),
});

// `challenge_list` enthält die Endgame-Modi, die stehen schon unter Herausforderungen.
const schema = z.object({
  act_list: z.array(act).optional().nullable(),
  avatar_card_pool_list: z.array(warp).optional().nullable(),
  equip_card_pool_list: z.array(warp).optional().nullable(),
});

const TAG: Record<string, string> = { ActivityTypeSign: "Login", ActivityTypeDouble: "Doppelt" };

function toEvent(a: z.infer<typeof act>, now: Date): GameEvent {
  const start = unixDate(a.time_info?.start_ts);
  const done = !!a.all_finished || a.act_status === "OtherActStatusFinish" || a.act_status === "SignStatusFinish";
  const e: GameEvent = {
    id: a.id,
    // Namen enthalten teils `\n` als Text.
    name: plain(a.name.replace(/\\n/g, " ")),
    start,
    end: unixDate(a.time_info?.end_ts),
    // "...Unopened" meldet die API auch für Events, deren Zeitraum schon läuft, die aber noch gesperrt sind.
    status: a.act_status?.endsWith("Unopened") && !done ? "upcoming" : eventStatus(start, done, now),
    tag: TAG[a.act_type ?? ""],
    description: a.panel_desc ? plain(multiline(a.panel_desc)) || undefined : undefined,
    rewards: (a.reward_list ?? [])
      .filter((r) => r.name)
      .map((r) => ({ name: r.name!, count: r.num ?? 0, iconUrl: r.icon ?? undefined })),
  };
  if (a.total_progress) e.progress = { current: a.current_progress ?? 0, max: a.total_progress };
  return e;
}

const WARP_NAME = { character: "Charakter-Aktionssprung", lightCone: "Lichtkegel-Aktionssprung" };
// Die API liefert als Namen oft nur den allgemeinen Begriff oder nichts; dann zählt die Liste, aus der das Banner kommt.
const GENERIC_NAMES = new Set(["", "sprung", "warp"]);

function toBanner(w: z.infer<typeof warp>, kind: keyof typeof WARP_NAME, now: Date): Banner {
  const start = unixDate(w.time_info?.start_ts);
  const name = plain(w.name);
  return {
    id: `${kind}-${w.id}`,
    name: GENERIC_NAMES.has(name.toLowerCase()) ? WARP_NAME[kind] : name,
    kind: kind === "character" ? "character" : "weapon",
    start,
    end: unixDate(w.time_info?.end_ts),
    status: bannerStatus(start, now),
    items: [
      ...(w.avatar_list ?? []).map((i) => ({ name: i.item_name, iconUrl: i.icon_url, rarity: i.rarity })),
      ...(w.equip_list ?? []).map((i) => ({ name: i.item_name, iconUrl: i.item_url, rarity: i.rarity })),
    ]
      .filter((i) => i.name)
      .map((i) => ({ name: i.name!, iconUrl: i.iconUrl ?? undefined, rarity: toRarity(i.rarity) })),
  };
}

export function parseStarRailEvents(data: unknown, now = new Date()): EventCalendar {
  const d = parseOrThrow(schema, data);
  return {
    events: (d.act_list ?? []).map((a) => toEvent(a, now)).filter((e) => isCurrent(e, now)),
    banners: [
      ...(d.avatar_card_pool_list ?? []).map((w) => toBanner(w, "character", now)),
      ...(d.equip_card_pool_list ?? []).map((w) => toBanner(w, "lightCone", now)),
    ].filter((b) => isCurrent(b, now)),
  };
}

export const starrailEvents: EventAdapter = {
  game: "starrail",
  fetchCalendar: (account, signal) =>
    fetchWithCredentials(account, async (creds) =>
      parseStarRailEvents(
        await hoyoGet(
          `https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/get_act_calender?server=${account.region}&role_id=${account.uid}`,
          creds,
          signal,
        ),
      ),
    ),
};
