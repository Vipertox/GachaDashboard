import { z } from "zod";
import { fetchWithCredentials } from "../adapters/credentialsForAccount";
import { optNum, parseOrThrow } from "../adapters/util";
import { optStr } from "../characters/util";
import { hoyoGet, roleParams } from "../hoyolab";
import { challenge, fmtNum, partialTime, pickPeriod, plain, scheduleType, serverDate, serverOffset } from "./util";
import type { Account, Challenge, ChallengeMode, ChallengePeriod, Fact } from "../../model/types";

const BASE = "https://bbs-api-os.hoyolab.com/game_record/hkrpg/api";

const query = (account: Account) => roleParams(account);

const season = z.object({ name_mi18n: optStr, begin_time: partialTime, end_time: partialTime });

// Memory of Chaos, Pure Fiction und Apocalyptic Shadow haben dasselbe Format.
const floorsSchema = z.object({
  groups: z.array(season).optional().nullable(),
  star_num: optNum,
  extra_star_num: optNum,
  max_floor: optStr,
  battle_num: optNum,
  has_data: z.boolean().optional(),
});

/** Höchstwerte: Memory of Chaos hat 12 Stufen, Pure Fiction und Apocalyptic Shadow je 4, mit je 3 Sternen. */
export function parseFloors(data: unknown, maxStars: number, region: string): Challenge {
  const d = parseOrThrow(floorsSchema, data);
  const offset = serverOffset(region);
  const g = d.groups?.[0];
  const period = {
    season: plain(g?.name_mi18n) || undefined,
    start: serverDate(g?.begin_time, offset),
    end: serverDate(g?.end_time, offset),
  };
  if (!d.has_data) return challenge({ ...period, state: "empty" });
  const facts: Fact[] = [
    { label: "Höchste Stufe", value: plain(d.max_floor) || "–" },
    { label: "Kämpfe", value: fmtNum(d.battle_num ?? 0) },
  ];
  if (d.extra_star_num) facts.push({ label: "Zusatzsterne", value: fmtNum(d.extra_star_num) });
  return challenge({ ...period, progress: { current: d.star_num ?? 0, max: maxStars, unit: "Sterne" }, facts });
}

const peakSchema = z.object({
  challenge_peak_records: z
    .array(
      z.object({
        group: season.optional().nullable(),
        boss_info: z.object({ name_mi18n: optStr }).optional().nullable(),
        has_challenge_record: z.boolean().optional(),
        battle_num: optNum,
        boss_stars: optNum,
        mob_stars: optNum,
      }),
    )
    .optional()
    .nullable(),
});

/** Anomaly Arbitration liefert alle Perioden in `challenge_peak_records`; gewählt wird nach Startzeit. */
export function parsePeak(data: unknown, p: ChallengePeriod, region: string): Challenge {
  const d = parseOrThrow(peakSchema, data);
  const offset = serverOffset(region);
  const r = pickPeriod(d.challenge_peak_records ?? [], p, (e) => serverDate(e.group?.begin_time, offset));
  const period = {
    season: plain(r?.group?.name_mi18n) || undefined,
    start: serverDate(r?.group?.begin_time, offset),
    end: serverDate(r?.group?.end_time, offset),
  };
  if (!r?.has_challenge_record) return challenge({ ...period, state: "empty" });
  const stars = (r.boss_stars ?? 0) + (r.mob_stars ?? 0);
  const facts: Fact[] = [];
  if (r.boss_info?.name_mi18n) facts.push({ label: "Boss", value: plain(r.boss_info.name_mi18n) });
  facts.push(
    { label: "Sterne Boss", value: fmtNum(r.boss_stars ?? 0) },
    { label: "Sterne Gegner", value: fmtNum(r.mob_stars ?? 0) },
    { label: "Kämpfe", value: fmtNum(r.battle_num ?? 0) },
  );
  return challenge({ ...period, summary: `${stars} Sterne`, facts });
}

function floors(key: string, label: string, endpoint: string, maxStars: number): ChallengeMode {
  return {
    key,
    label,
    fetch: (account, period, signal) =>
      fetchWithCredentials(account, async (creds) =>
        parseFloors(
          await hoyoGet(`${BASE}/${endpoint}?${query(account)}&schedule_type=${scheduleType(period)}&need_all=true`, creds, signal),
          maxStars,
          account.region,
        ),
      ),
  };
}

export const starrailChallenges: ChallengeMode[] = [
  floors("moc", "Memory of Chaos", "challenge", 36),
  floors("pf", "Pure Fiction", "challenge_story", 12),
  floors("as", "Apocalyptic Shadow", "challenge_boss", 12),
  {
    key: "aa",
    label: "Anomaly Arbitration",
    // schedule_type 3 liefert wie in genshin.py die Liste aller Perioden.
    fetch: (account, period, signal) =>
      fetchWithCredentials(account, async (creds) =>
        parsePeak(await hoyoGet(`${BASE}/challenge_peak?${query(account)}&schedule_type=3`, creds, signal), period, account.region),
      ),
  },
];
