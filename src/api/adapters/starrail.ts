import { z } from "zod";
import { fetchWithCredentials } from "./credentialsForAccount";
import { hoyoGet } from "../hoyolab";
import { makeResource, nonEmpty, num, optNum, parseOrThrow, section, timer } from "./util";
import type { Account, GameAdapter, GameStatus } from "../../model/types";

const schema = z.object({
  current_stamina: num,
  max_stamina: num,
  stamina_recover_time: num,
  current_reserve_stamina: optNum,
  is_reserve_stamina_full: z.boolean().optional(),
  current_train_score: optNum,
  max_train_score: optNum,
  current_rogue_score: optNum,
  max_rogue_score: optNum,
  // Rohfeld heißt weekly_cocoon_*, genshin.py nennt es remaining_weekly_discounts
  weekly_cocoon_cnt: optNum,
  weekly_cocoon_limit: optNum,
  remaining_weekly_discounts: optNum,
  max_weekly_discounts: optNum,
  have_bonus_synchronicity_points: z.boolean().optional(),
  current_bonus_synchronicity_points: optNum,
  max_bonus_synchronicity_points: optNum,
  accepted_epedition_num: optNum,
  accepted_expedition_num: optNum,
  total_expedition_num: optNum,
  expeditions: z
    .array(
      z.object({
        name: z.string().optional(),
        avatars: z.array(z.string()).optional(),
        status: z.string().optional(),
        remaining_time: num,
      }),
    )
    .optional(),
});

export function parseStarRail(data: unknown, account: Account, now = new Date()): GameStatus {
  const d = parseOrThrow(schema, data);
  const power = makeResource({
    label: "Trailblaze Power",
    iconKey: "starrail/power",
    current: d.current_stamina,
    max: d.max_stamina,
    recoverSeconds: d.stamina_recover_time,
    regenSeconds: 360,
    now,
  });

  const reserve =
    d.current_reserve_stamina !== undefined
      ? [
          makeResource({
            label: "Reserved Trailblaze Power",
            iconKey: "starrail/reserve",
            current: d.current_reserve_stamina,
            // Die API liefert kein Maximum, nur ob die Reserve voll ist.
            max: d.is_reserve_stamina_full ? d.current_reserve_stamina : 2400,
            now,
          }),
        ]
      : [];

  const daily = section("daily", {
    tasks:
      d.max_train_score !== undefined
        ? [
            {
              label: "Daily Training",
              done: d.current_train_score ?? 0,
              total: d.max_train_score,
              iconKey: "starrail/training",
            },
          ]
        : [],
  });

  const remaining = d.remaining_weekly_discounts ?? d.weekly_cocoon_cnt;
  const limit = d.max_weekly_discounts ?? d.weekly_cocoon_limit;
  const weekly = section("weekly", {
    flags:
      remaining !== undefined && limit !== undefined
        ? [{ label: "Echo of War", done: remaining === 0, text: `${remaining} von ${limit} übrig` }]
        : [],
    resources: [
      ...(d.max_rogue_score
        ? [
            makeResource({
              label: "Simulated Universe",
              iconKey: "starrail/rogue",
              current: d.current_rogue_score ?? 0,
              max: d.max_rogue_score,
              now,
            }),
          ]
        : []),
      ...(d.have_bonus_synchronicity_points && d.max_bonus_synchronicity_points
        ? [
            makeResource({
              label: "Divergent Universe, Bonuspunkte",
              iconKey: "starrail/divergent",
              current: d.current_bonus_synchronicity_points ?? 0,
              max: d.max_bonus_synchronicity_points,
              now,
            }),
          ]
        : []),
    ],
  });

  const accepted = d.accepted_expedition_num ?? d.accepted_epedition_num;
  const running = section("running", {
    tasks:
      accepted !== undefined && d.total_expedition_num !== undefined
        ? [{ label: "Assignments vergeben", done: accepted, total: d.total_expedition_num }]
        : [],
    timers: (d.expeditions ?? []).map((e, i) =>
      timer(
        e.name ?? `Assignment ${i + 1}`,
        e.status === "Finished" ? 0 : e.remaining_time,
        now,
        e.avatars?.[0],
      ),
    ),
  });

  // Die Reserve steht laut Konzept im Kopf der Detailseite (über `secondary`).
  return {
    game: "starrail",
    uid: account.uid,
    nickname: account.nickname ?? account.uid,
    primary: power,
    secondary: reserve,
    tasks: daily.tasks,
    sections: [daily, weekly, running].filter(nonEmpty),
    fetchedAt: now,
  };
}

export const starrailAdapter: GameAdapter = {
  game: "starrail",
  fetchStatus: (account, signal) =>
    fetchWithCredentials(account, async (creds) => {
      const data = await hoyoGet(
        `https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/note?server=${account.region}&role_id=${account.uid}`,
        creds,
        signal,
      );
      return parseStarRail(data, account);
    }),
};
