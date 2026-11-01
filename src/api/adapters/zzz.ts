import { z } from "zod";
import { fetchWithCredentials } from "./credentialsForAccount";
import { hoyoGet } from "../hoyolab";
import { makeResource, nonEmpty, num, optNum, parseOrThrow, section } from "./util";
import type { Account, GameAdapter, GameStatus } from "../../model/types";

const schema = z.object({
  energy: z.object({
    progress: z.object({ current: num, max: num }),
    restore: num,
  }),
  vitality: z.object({ current: num, max: num }).optional(),
  card_sign: z.string().optional(),
  vhs_sale: z.object({ sale_state: z.string().optional() }).optional(),
  bounty_commission: z
    .object({ num: optNum, total: optNum })
    .optional()
    .nullable(),
  survey_points: z
    .object({ num: optNum, total: optNum })
    .optional()
    .nullable(),
});

const VHS_TEXT: Record<string, string> = {
  SaleStateNo: "Offen",
  SaleStateDoing: "Läuft",
  SaleStateDone: "Umsatz abholbar",
};

export function parseZzz(data: unknown, account: Account, now = new Date()): GameStatus {
  const d = parseOrThrow(schema, data);
  const battery = makeResource({
    label: "Battery Charge",
    iconKey: "zzz/battery",
    current: d.energy.progress.current,
    max: d.energy.progress.max,
    recoverSeconds: d.energy.restore,
    regenSeconds: 360,
    now,
  });

  const daily = section("daily", {
    tasks: d.vitality
      ? [{ label: "Engagement", done: d.vitality.current, total: d.vitality.max, iconKey: "zzz/engagement" }]
      : [],
    flags: [
      ...(d.card_sign
        ? [{ label: "Scratch Card", done: d.card_sign === "CardSignDone", text: d.card_sign === "CardSignDone" ? "Erledigt" : "Offen" }]
        : []),
      ...(d.vhs_sale?.sale_state
        ? [
            {
              label: "Video Store",
              done: d.vhs_sale.sale_state === "SaleStateDone",
              text: VHS_TEXT[d.vhs_sale.sale_state] ?? d.vhs_sale.sale_state,
            },
          ]
        : []),
    ],
  });

  const bounty = d.bounty_commission;
  const survey = d.survey_points;
  const weekly = section("weekly", {
    tasks:
      bounty?.total !== undefined
        ? [{ label: "Bounty Commission", done: bounty.num ?? 0, total: bounty.total }]
        : [],
    resources:
      survey?.total
        ? [
            makeResource({
              label: "Survey Points",
              iconKey: "zzz/survey",
              current: survey.num ?? 0,
              max: survey.total,
              now,
            }),
          ]
        : [],
  });

  return {
    game: "zzz",
    uid: account.uid,
    nickname: account.nickname ?? account.uid,
    primary: battery,
    secondary: [],
    tasks: daily.tasks,
    sections: [daily, weekly].filter(nonEmpty),
    fetchedAt: now,
  };
}

export const zzzAdapter: GameAdapter = {
  game: "zzz",
  fetchStatus: (account, signal) =>
    fetchWithCredentials(account, async (creds) => {
      const data = await hoyoGet(
        `https://sg-act-nap-api.hoyolab.com/event/game_record_zzz/api/zzz/note?server=${account.region}&role_id=${account.uid}`,
        creds,
        signal,
      );
      return parseZzz(data, account);
    }),
};
