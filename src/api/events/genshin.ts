import { z } from "zod";
import { fetchWithCredentials } from "../adapters/credentialsForAccount";
import { num, optNum, parseOrThrow } from "../adapters/util";
import { plain, unixDate } from "../challenges/util";
import { optStr, str } from "../characters/util";
import { hoyoPost } from "../hoyolab";
import { bannerStatus, eventStatus, isCurrent, multiline, rarity, toRarity } from "./util";
import type { Banner, EventAdapter, EventCalendar, GameEvent } from "../../model/types";

const item = z.object({ name: optStr, icon: optStr, rarity });

const pool = z.object({
  pool_id: str,
  pool_name: optStr,
  start_timestamp: optNum,
  end_timestamp: optNum,
  avatars: z.array(item).optional().nullable(),
  weapon: z.array(item).optional().nullable(),
});

const act = z.object({
  id: str,
  name: str,
  desc: optStr,
  start_timestamp: optNum,
  end_timestamp: optNum,
  is_finished: z.boolean().optional(),
  reward_list: z.array(z.object({ name: optStr, icon: optStr, num: optNum })).optional().nullable(),
  explore_detail: z.object({ explore_percent: optNum, is_finished: z.boolean().optional() }).optional().nullable(),
  double_detail: z.object({ total: num, left: num }).optional().nullable(),
});

// `fixed_act_list` enthält Abyss, Theater und Stygian Onslaught, die stehen schon unter Herausforderungen.
const schema = z.object({
  act_list: z.array(act).optional().nullable(),
  avatar_card_pool_list: z.array(pool).optional().nullable(),
  weapon_card_pool_list: z.array(pool).optional().nullable(),
  mixed_card_pool_list: z.array(pool).optional().nullable(),
});

function toEvent(a: z.infer<typeof act>, now: Date): GameEvent {
  const start = unixDate(a.start_timestamp);
  const e: GameEvent = {
    id: a.id,
    name: plain(a.name),
    start,
    end: unixDate(a.end_timestamp),
    status: eventStatus(start, !!a.is_finished, now),
    description: a.desc ? plain(multiline(a.desc)) || undefined : undefined,
    rewards: (a.reward_list ?? [])
      .filter((r) => r.name)
      .map((r) => ({ name: r.name!, count: r.num ?? 0, iconUrl: r.icon ?? undefined })),
  };
  if (a.explore_detail) {
    e.progress = { current: Math.round(a.explore_detail.explore_percent ?? 0), max: 100, unit: "%" };
  } else if (a.double_detail) {
    e.tag = "Doppelt";
    e.progress = { current: a.double_detail.total - a.double_detail.left, max: a.double_detail.total };
  }
  return e;
}

function toBanner(p: z.infer<typeof pool>, now: Date): Banner {
  const start = unixDate(p.start_timestamp);
  return {
    id: p.pool_id,
    name: plain(p.pool_name) || "Gebet",
    start,
    end: unixDate(p.end_timestamp),
    status: bannerStatus(start, now),
    items: [...(p.avatars ?? []), ...(p.weapon ?? [])]
      .filter((i) => i.name)
      .map((i) => ({ name: i.name!, iconUrl: i.icon ?? undefined, rarity: toRarity(i.rarity) })),
  };
}

export function parseGenshinEvents(data: unknown, now = new Date()): EventCalendar {
  const d = parseOrThrow(schema, data);
  const pools = [...(d.avatar_card_pool_list ?? []), ...(d.weapon_card_pool_list ?? []), ...(d.mixed_card_pool_list ?? [])];
  return {
    events: (d.act_list ?? []).map((a) => toEvent(a, now)).filter((e) => isCurrent(e, now)),
    banners: pools.map((p) => toBanner(p, now)).filter((b) => isCurrent(b, now)),
  };
}

export const genshinEvents: EventAdapter = {
  game: "genshin",
  fetchCalendar: (account, signal) =>
    fetchWithCredentials(account, async (creds) =>
      parseGenshinEvents(
        await hoyoPost(
          "https://bbs-api-os.hoyolab.com/game_record/genshin/api/act_calendar",
          creds,
          { role_id: account.uid, server: account.region },
          signal,
        ),
      ),
    ),
};
