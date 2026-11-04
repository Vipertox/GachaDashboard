import { z } from "zod";
import { fetchWithCredentials } from "../adapters/credentialsForAccount";
import { num, optNum, parseOrThrow } from "../adapters/util";
import { optStr } from "../characters/util";
import { hoyoGet, roleParams, uidParams } from "../hoyolab";
import { challenge, fmtNum, fmtRank, partialTime, plain, scheduleType, serverDate, serverOffset } from "./util";
import type { Account, Challenge, ChallengeMode, ChallengePeriod, Fact } from "../../model/types";

const BASE = "https://sg-act-nap-api.hoyolab.com/event/game_record_zzz/api/zzz";

// Shiyu Defense nimmt `role_id`, die neueren Modi wie in genshin.py `uid` und `region`.
const roleQuery = (a: Account, p: ChallengePeriod) => `${roleParams(a)}&schedule_type=${scheduleType(p)}`;
const uidQuery = (a: Account, p: ChallengePeriod) => `${uidParams(a)}&schedule_type=${scheduleType(p)}`;

const shiyuSchema = z.object({
  hadal_ver: optStr,
  hadal_info_v1: z
    .object({
      hadal_begin_time: partialTime,
      hadal_end_time: partialTime,
      has_data: z.boolean().optional(),
      max_layer: optNum,
      rating_list: z.array(z.object({ rating: optStr, times: num })).optional().nullable(),
    })
    .optional()
    .nullable(),
  hadal_info_v2: z
    .object({
      hadal_begin_time: partialTime,
      hadal_end_time: partialTime,
      pass_fifth_floor: z.boolean().optional(),
      brief: z
        .object({ score: optNum, max_score: optNum, rank_percent: optNum, rating: optStr })
        .optional()
        .nullable(),
    })
    .optional()
    .nullable(),
});

/** Shiyu Defense gibt es in zwei Fassungen, `hadal_ver` sagt, welcher Block gefüllt ist. */
export function parseShiyu(data: unknown, region: string): Challenge {
  const d = parseOrThrow(shiyuSchema, data);
  const offset = serverOffset(region);
  if (d.hadal_ver === "v1") {
    const v1 = d.hadal_info_v1;
    const period = { start: serverDate(v1?.hadal_begin_time, offset), end: serverDate(v1?.hadal_end_time, offset) };
    if (!v1?.has_data) return challenge({ ...period, state: "empty" });
    const ratings = (v1.rating_list ?? []).filter((r) => r.times > 0).map((r) => `${r.rating} ×${r.times}`);
    return challenge({
      ...period,
      summary: `Stufe ${v1.max_layer ?? 0}`,
      facts: [
        { label: "Höchste Stufe", value: fmtNum(v1.max_layer ?? 0) },
        { label: "Bewertungen", value: ratings.join(" · ") || "–" },
      ],
    });
  }
  const v2 = d.hadal_info_v2;
  const period = { start: serverDate(v2?.hadal_begin_time, offset), end: serverDate(v2?.hadal_end_time, offset) };
  const b = v2?.brief;
  if (!b?.score) return challenge({ ...period, state: "empty" });
  const facts: Fact[] = [];
  if (b.rating) facts.push({ label: "Bewertung", value: b.rating });
  // Mit Höchstwert stehen die Punkte schon am Balken.
  if (!b.max_score) facts.push({ label: "Punkte", value: fmtNum(b.score) });
  if (b.rank_percent) facts.push({ label: "Rangliste", value: fmtRank(b.rank_percent) });
  facts.push({ label: "Fünfte Front", value: v2?.pass_fifth_floor ? "Geschafft" : "Offen" });
  return challenge({
    ...period,
    progress: b.max_score ? { current: b.score, max: b.max_score, unit: "Punkte" } : undefined,
    summary: b.rating ? `Rang ${b.rating} · ${fmtNum(b.score)} Punkte` : `${fmtNum(b.score)} Punkte`,
    facts,
  });
}

// Deadly Assault: 3 Bosse mit je 3 Sternen.
const ASSAULT_MAX_STARS = 9;

const assaultSchema = z.object({
  start_time: partialTime,
  end_time: partialTime,
  has_data: z.boolean().optional(),
  total_score: optNum,
  total_star: optNum,
  rank_percent: optNum,
});

export function parseAssault(data: unknown, region: string): Challenge {
  const d = parseOrThrow(assaultSchema, data);
  const offset = serverOffset(region);
  const period = { start: serverDate(d.start_time, offset), end: serverDate(d.end_time, offset) };
  if (!d.has_data) return challenge({ ...period, state: "empty" });
  const facts: Fact[] = [{ label: "Punkte", value: fmtNum(d.total_score ?? 0) }];
  if (d.rank_percent) facts.push({ label: "Rangliste", value: fmtRank(d.rank_percent) });
  return challenge({ ...period, progress: { current: d.total_star ?? 0, max: ASSAULT_MAX_STARS, unit: "Sterne" }, facts });
}

const thresholdSchema = z.object({
  void_front_battle_abstract_info_brief: z
    .object({ has_ending_record: z.boolean().optional(), ending_record_name: optStr, total_score: optNum, rank_percent: optNum })
    .optional()
    .nullable(),
});

/** Threshold Simulation liefert keine Datumsangaben, nur Punkte, Rang und das erreichte Ende. */
export function parseThreshold(data: unknown): Challenge {
  const b = parseOrThrow(thresholdSchema, data).void_front_battle_abstract_info_brief;
  if (!b?.has_ending_record) return challenge({ state: "empty" });
  const facts: Fact[] = [{ label: "Punkte", value: fmtNum(b.total_score ?? 0) }];
  if (b.rank_percent) facts.push({ label: "Rangliste", value: fmtRank(b.rank_percent) });
  if (b.ending_record_name) facts.push({ label: "Ende", value: plain(b.ending_record_name) });
  return challenge({ summary: `${fmtNum(b.total_score ?? 0)} Punkte`, facts });
}

function mode(key: string, label: string, url: (a: Account, p: ChallengePeriod) => string, parse: (d: unknown, region: string) => Challenge): ChallengeMode {
  return {
    key,
    label,
    fetch: (account, period, signal) =>
      fetchWithCredentials(account, async (creds) => parse(await hoyoGet(url(account, period), creds, signal), account.region)),
  };
}

export const zzzChallenges: ChallengeMode[] = [
  mode("shiyu", "Shiyu Defense", (a, p) => `${BASE}/hadal_info_v2?${roleQuery(a, p)}`, parseShiyu),
  mode("assault", "Deadly Assault", (a, p) => `${BASE}/hadal_mem_detail_v2?${uidQuery(a, p)}`, parseAssault),
  mode("threshold", "Threshold Simulation", (a, p) => `${BASE}/void_front_battle_period_abstract_info?${uidQuery(a, p)}`, parseThreshold),
];
