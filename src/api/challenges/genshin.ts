import { z } from "zod";
import { fetchWithCredentials } from "../adapters/credentialsForAccount";
import { num, optNum, parseOrThrow } from "../adapters/util";
import { optStr } from "../characters/util";
import { hoyoGet } from "../hoyolab";
import { challenge, fmtNum, pickPeriod, scheduleType, unixDate } from "./util";
import type { Account, Challenge, ChallengeMode, ChallengePeriod, Fact } from "../../model/types";

const BASE = "https://bbs-api-os.hoyolab.com/game_record/genshin/api";

const query = (account: Account) => `server=${account.region}&role_id=${account.uid}`;

// Spiral Abyss: Etagen 9–12 mit je 3 Kammern zu 3 Sternen.
const ABYSS_MAX_STARS = 36;

const abyssSchema = z.object({
  is_unlock: z.boolean().optional(),
  start_time: optNum,
  end_time: optNum,
  total_star: optNum,
  max_floor: optStr,
  total_battle_times: optNum,
  total_win_times: optNum,
  floors: z.array(z.object({ index: num, star: optNum, max_star: optNum })).optional().nullable(),
});

export function parseAbyss(data: unknown): Challenge {
  const d = parseOrThrow(abyssSchema, data);
  const period = { start: unixDate(d.start_time), end: unixDate(d.end_time) };
  if (d.is_unlock === false) return challenge({ ...period, state: "locked" });
  if (!d.total_battle_times) return challenge({ ...period, state: "empty" });
  const facts: Fact[] = [
    { label: "Tiefste Kammer", value: d.max_floor ?? "–" },
    { label: "Kämpfe gewonnen", value: `${d.total_win_times ?? 0} von ${d.total_battle_times}` },
  ];
  for (const f of [...(d.floors ?? [])].sort((a, b) => a.index - b.index)) {
    if (f.index >= 9) facts.push({ label: `Etage ${f.index}`, value: `${f.star ?? 0}/${f.max_star ?? 9} Sterne` });
  }
  return challenge({ ...period, progress: { current: d.total_star ?? 0, max: ABYSS_MAX_STARS, unit: "Sterne" }, facts });
}

const THEATER_DIFFICULTY: Record<number, { label: string; acts: number }> = {
  1: { label: "Leicht", acts: 3 },
  2: { label: "Normal", acts: 6 },
  3: { label: "Schwer", acts: 8 },
  4: { label: "Visionär", acts: 10 },
  5: { label: "Arkana", acts: 10 },
};

const theaterSchema = z.object({
  is_unlock: z.boolean().optional(),
  data: z
    .array(
      z.object({
        has_data: z.boolean().optional(),
        schedule: z.object({ start_time: optNum, end_time: optNum }).optional().nullable(),
        stat: z
          .object({ difficulty_id: optNum, max_round_id: optNum, medal_num: optNum, coin_num: optNum })
          .optional()
          .nullable(),
      }),
    )
    .optional()
    .nullable(),
});

/** `role_combat` kennt kein `schedule_type`, die Antwort enthält laufende und vorherige Periode. */
export function parseTheater(data: unknown, p: ChallengePeriod): Challenge {
  const d = parseOrThrow(theaterSchema, data);
  const entry = pickPeriod(d.data ?? [], p, (e) => unixDate(e.schedule?.start_time));
  const period = { start: unixDate(entry?.schedule?.start_time), end: unixDate(entry?.schedule?.end_time) };
  if (d.is_unlock === false) return challenge({ ...period, state: "locked" });
  const s = entry?.stat;
  if (!entry?.has_data || !s?.max_round_id) return challenge({ ...period, state: "empty" });
  const diff = THEATER_DIFFICULTY[s.difficulty_id ?? 0];
  const facts: Fact[] = [
    { label: "Schwierigkeit", value: diff?.label ?? `Stufe ${s.difficulty_id ?? "?"}` },
    { label: "Medaillen", value: fmtNum(s.medal_num ?? 0) },
    { label: "Fantasia-Blumen", value: fmtNum(s.coin_num ?? 0) },
  ];
  return challenge({
    ...period,
    progress: diff ? { current: s.max_round_id, max: diff.acts, unit: "Akte" } : undefined,
    summary: `Akt ${s.max_round_id}${diff ? `/${diff.acts}` : ""}`,
    facts,
  });
}

const best = z.object({ difficulty: optNum, second: optNum }).optional().nullable();
const stygianMode = z.object({ best, has_data: z.boolean().optional() }).optional().nullable();

const stygianSchema = z.object({
  is_unlock: z.boolean().optional(),
  data: z
    .array(
      z.object({
        schedule: z
          .object({ name: optStr, start_time: optNum, end_time: optNum, is_valid: z.boolean().optional() })
          .optional()
          .nullable(),
        single: stygianMode,
        mp: stygianMode,
      }),
    )
    .optional()
    .nullable(),
});

const stygianBest = (m: z.infer<typeof stygianMode>) =>
  m?.has_data && m.best?.difficulty ? `Stufe ${m.best.difficulty} · ${m.best.second ?? 0} s` : undefined;

export function parseStygian(data: unknown, p: ChallengePeriod): Challenge {
  const d = parseOrThrow(stygianSchema, data);
  // Wie genshin.py: Einträge mit `is_valid: false` sind leere Platzhalter.
  const entry = pickPeriod(
    (d.data ?? []).filter((e) => e.schedule?.is_valid !== false),
    p,
    (e) => unixDate(e.schedule?.start_time),
  );
  const period = {
    season: entry?.schedule?.name ?? undefined,
    start: unixDate(entry?.schedule?.start_time),
    end: unixDate(entry?.schedule?.end_time),
  };
  if (d.is_unlock === false) return challenge({ ...period, state: "locked" });
  const single = stygianBest(entry?.single);
  const mp = stygianBest(entry?.mp);
  if (!single && !mp) return challenge({ ...period, state: "empty" });
  const facts: Fact[] = [];
  if (single) facts.push({ label: "Bestwert allein", value: single });
  if (mp) facts.push({ label: "Bestwert Koop", value: mp });
  return challenge({ ...period, summary: single ?? mp, facts });
}

function mode(key: string, label: string, url: (a: Account, p: ChallengePeriod) => string, parse: (d: unknown, p: ChallengePeriod) => Challenge): ChallengeMode {
  return {
    key,
    label,
    fetch: (account, period, signal) =>
      fetchWithCredentials(account, async (creds) => parse(await hoyoGet(url(account, period), creds, signal), period)),
  };
}

export const genshinChallenges: ChallengeMode[] = [
  mode("abyss", "Spiral Abyss", (a, p) => `${BASE}/spiralAbyss?${query(a)}&schedule_type=${scheduleType(p)}`, parseAbyss),
  mode("theater", "Imaginarium Theater", (a) => `${BASE}/role_combat?${query(a)}&need_detail=false`, parseTheater),
  mode("stygian", "Stygian Onslaught", (a) => `${BASE}/hard_challenge?${query(a)}&need_detail=false`, parseStygian),
];
