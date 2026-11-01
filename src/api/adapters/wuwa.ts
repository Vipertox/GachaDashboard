import { z } from "zod";
import { ApiError } from "../errors";
import { queryRole } from "../kuro";
import { makeResource, nonEmpty, num, optNum, parseOrThrow, section } from "./util";
import type { Account, GameAdapter, GameStatus } from "../../model/types";

const schema = z.object({
  Base: z.object({
    Name: z.string().optional(),
    Energy: num,
    MaxEnergy: num,
    // Unix-Millisekunden des Zeitpunkts, an dem die Waveplates voll sind; 0 = voll
    EnergyRecoverTime: optNum,
    StoreEnergy: optNum,
    MaxStoreEnergy: optNum,
    Liveness: optNum,
    LivenessMaxCount: optNum,
    LivenessUnlock: z.boolean().optional(),
    WeeklyInstCount: optNum,
  }),
  BattlePass: z
    .object({
      IsOpen: z.boolean().optional(),
      Level: optNum,
      WeekExp: optNum,
      WeekMaxExp: optNum,
    })
    .optional()
    .nullable(),
});

export function parseWuwa(data: unknown, account: Account, now = new Date()): GameStatus {
  const d = parseOrThrow(schema, data);
  const b = d.Base;

  const waveplates = makeResource({
    label: "Waveplates",
    iconKey: "wuwa/waveplate",
    current: b.Energy,
    max: b.MaxEnergy,
    fullAtMs: b.EnergyRecoverTime,
    regenSeconds: 360,
    now,
  });

  const crystal =
    b.StoreEnergy !== undefined && b.MaxStoreEnergy !== undefined
      ? [
          makeResource({
            label: "Waveplate Crystal",
            iconKey: "wuwa/crystal",
            current: b.StoreEnergy,
            max: b.MaxStoreEnergy,
            now,
          }),
        ]
      : [];

  const daily = section("daily", {
    tasks:
      b.LivenessUnlock !== false && b.LivenessMaxCount
        ? [{ label: "Tagesaktivität", done: b.Liveness ?? 0, total: b.LivenessMaxCount, iconKey: "wuwa/activity" }]
        : [],
  });

  const bp = d.BattlePass;
  const weekly = section("weekly", {
    flags:
      b.WeeklyInstCount !== undefined
        ? [
            {
              label: "Wochenboss-Belohnungen",
              done: b.WeeklyInstCount === 0,
              text: `${b.WeeklyInstCount} übrig`,
            },
          ]
        : [],
    resources:
      bp?.IsOpen && bp.WeekMaxExp
        ? [
            makeResource({
              label: `Pioneer Podcast (Stufe ${bp.Level ?? 0})`,
              iconKey: "wuwa/podcast",
              current: bp.WeekExp ?? 0,
              max: bp.WeekMaxExp,
              now,
            }),
          ]
        : [],
  });

  const other = section("other", { resources: crystal });

  return {
    game: "wuwa",
    uid: account.uid,
    nickname: b.Name ?? account.nickname ?? account.uid,
    primary: waveplates,
    secondary: crystal,
    tasks: daily.tasks,
    sections: [daily, weekly, other].filter(nonEmpty),
    fetchedAt: now,
  };
}

export const wuwaAdapter: GameAdapter = {
  game: "wuwa",
  fetchStatus: async (account, signal) => {
    if (!account.oauthCode) throw new ApiError("missing_credentials", "Kuro-Code fehlt");
    const data = await queryRole(account.oauthCode, { playerId: account.uid, region: account.region }, signal);
    return parseWuwa(data, account);
  },
};
