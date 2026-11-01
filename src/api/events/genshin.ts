import { z } from "zod";
import { fetchWithCredentials } from "../adapters/credentialsForAccount";
import { num, optNum, parseOrThrow } from "../adapters/util";
import { plain, unixDate } from "../challenges/util";
import { optStr, str } from "../characters/util";
import { hoyoPost } from "../hoyolab";
import { bannerStatus, currencyFromRewards, eventStatus, isCurrent, multiline, rarity, rewardSchema, toRarity } from "./util";
import type { Banner, BannerKind, EventAdapter, EventCalendar, GameEvent } from "../../model/types";

const item = z.object({ name: optStr, icon: optStr, rarity });

const pool = z.object({
  pool_id: str,
  pool_name: optStr,
  version_name: optStr,
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
  reward_list: z.array(rewardSchema).optional().nullable(),
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

// Primogem hat die Item-ID 201.
const PRIMOGEMS = { id: 201, name: /primogem/i, label: "Primogems" };

function toEvent(a: z.infer<typeof act>, now: Date): GameEvent {
  const start = unixDate(a.start_timestamp);
  const e: GameEvent = {
    currency: currencyFromRewards(a.reward_list, PRIMOGEMS, !!a.is_finished),
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

function toBanner(p: z.infer<typeof pool>, kind: BannerKind, now: Date): Banner {
  const start = unixDate(p.start_timestamp);
  return {
    id: `${kind}-${p.pool_id}`,
    name: plain(p.pool_name) || "Gebet",
    kind,
    version: p.version_name || undefined,
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
  return {
    events: (d.act_list ?? []).map((a) => toEvent(a, now)).filter((e) => isCurrent(e, now)),
    // Das Chronik-Gebet (`mixed_card_pool_list`) enthält Figuren und Waffen und zählt zu "Weitere".
    banners: [
      ...(d.avatar_card_pool_list ?? []).map((p) => toBanner(p, "character", now)),
      ...(d.weapon_card_pool_list ?? []).map((p) => toBanner(p, "weapon", now)),
      ...(d.mixed_card_pool_list ?? []).map((p) => toBanner(p, "other", now)),
    ].filter((b) => isCurrent(b, now)),
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
