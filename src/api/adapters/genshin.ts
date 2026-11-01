import { z } from "zod";
import { fetchWithCredentials } from "./credentialsForAccount";
import { hoyoGet } from "../hoyolab";
import { makeResource, nonEmpty, num, optNum, parseOrThrow, section, timer } from "./util";
import type { Account, GameAdapter, GameStatus } from "../../model/types";

const schema = z.object({
  current_resin: num,
  max_resin: num,
  resin_recovery_time: num,
  finished_task_num: optNum,
  total_task_num: optNum,
  is_extra_task_reward_received: z.boolean().optional(),
  remain_resin_discount_num: optNum,
  resin_discount_num_limit: optNum,
  current_home_coin: optNum,
  max_home_coin: optNum,
  home_coin_recovery_time: optNum,
  daily_task: z.object({ stored_attendance: optNum }).partial().optional().nullable(),
  expeditions: z
    .array(
      z.object({
        avatar_side_icon: z.string().optional(),
        status: z.string().optional(),
        remained_time: num,
      }),
    )
    .optional(),
  transformer: z
    .object({
      obtained: z.boolean().optional(),
      recovery_time: z
        .object({
          Day: optNum,
          Hour: optNum,
          Minute: optNum,
          Second: optNum,
          reached: z.boolean().optional(),
        })
        .optional(),
    })
    .optional()
    .nullable(),
});

export function parseGenshin(data: unknown, account: Account, now = new Date()): GameStatus {
  const d = parseOrThrow(schema, data);
  const resin = makeResource({
    label: "Original Resin",
    iconKey: "genshin/resin",
    current: d.current_resin,
    max: d.max_resin,
    recoverSeconds: d.resin_recovery_time,
    regenSeconds: 480,
    now,
  });

  const daily = section("daily", {
    tasks:
      d.total_task_num !== undefined
        ? [
            {
              label: "Daily Commissions",
              done: d.finished_task_num ?? 0,
              total: d.total_task_num,
              iconKey: "genshin/commission",
            },
          ]
        : [],
    flags: [
      ...(d.is_extra_task_reward_received !== undefined
        ? [{ label: "Commission-Belohnung abgeholt", done: d.is_extra_task_reward_received }]
        : []),
      ...(d.daily_task?.stored_attendance !== undefined
        ? [
            {
              label: "Gespeicherte Begegnungspunkte",
              done: false,
              text: String(d.daily_task.stored_attendance),
            },
          ]
        : []),
    ],
  });

  const weekly = section("weekly", {
    flags:
      d.resin_discount_num_limit !== undefined
        ? [
            {
              label: "Wochenboss-Rabatte",
              done: (d.remain_resin_discount_num ?? 0) === 0,
              text: `${d.remain_resin_discount_num ?? 0} von ${d.resin_discount_num_limit} übrig`,
            },
          ]
        : [],
  });

  const running = section("running", {
    timers: (d.expeditions ?? []).map((e, i) =>
      timer(`Expedition ${i + 1}`, e.status === "Finished" ? 0 : e.remained_time, now, e.avatar_side_icon),
    ),
  });

  const secondary =
    d.max_home_coin !== undefined && d.current_home_coin !== undefined
      ? [
          makeResource({
            label: "Realm Currency",
            iconKey: "genshin/realm",
            current: d.current_home_coin,
            max: d.max_home_coin,
            recoverSeconds: d.home_coin_recovery_time,
            now,
          }),
        ]
      : [];

  const other = section("other", { resources: secondary, flags: [] });
  const tr = d.transformer;
  if (tr?.obtained && tr.recovery_time) {
    const t = tr.recovery_time;
    const secs = (t.Day ?? 0) * 86400 + (t.Hour ?? 0) * 3600 + (t.Minute ?? 0) * 60 + (t.Second ?? 0);
    const ready = t.reached === true || secs <= 0;
    other.flags.push({
      label: "Parametrischer Transformator",
      done: ready,
      text: ready ? "Bereit" : undefined,
    });
    if (!ready) other.timers.push(timer("Parametrischer Transformator", secs, now));
  }

  return {
    game: "genshin",
    uid: account.uid,
    nickname: account.nickname ?? account.uid,
    primary: resin,
    secondary,
    tasks: daily.tasks,
    sections: [daily, weekly, running, other].filter(nonEmpty),
    fetchedAt: now,
  };
}

export const genshinAdapter: GameAdapter = {
  game: "genshin",
  fetchStatus: (account, signal) =>
    fetchWithCredentials(account, async (creds) => {
      const data = await hoyoGet(
        `https://bbs-api-os.hoyolab.com/game_record/genshin/api/dailyNote?server=${account.region}&role_id=${account.uid}`,
        creds,
        signal,
      );
      return parseGenshin(data, account);
    }),
};
