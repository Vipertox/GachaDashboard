import { z } from "zod";
import { ApiError } from "../errors";
import { queryRole } from "../kuro";
import { makeResource, nonEmpty, num, optNum, parseOrThrow, section } from "./util";
import type { Account, GameAdapter, GameStatus } from "../../model/types";

const counts = z.record(z.string(), num).optional().nullable();

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
    RoleNum: optNum,
    StoreEnergyRecoverTime: optNum,
    Level: optNum,
    WorldLevel: optNum,
    ActiveDays: optNum,
    // Unix-Millisekunden der Kontoerstellung
    CreatTime: optNum,
    // Geöffnete Schatztruhen pro Stufe 1–4. BasicBoxes und PhantomBoxes sind nicht eindeutig belegt.
    Boxes: counts,
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
  MotorData: z
    .object({
      Level: optNum,
      Exp: optNum,
      NextExp: optNum,
      Skins: z.array(z.unknown()).optional().nullable(),
      Stickers: z.array(z.unknown()).optional().nullable(),
    })
    .optional()
    .nullable(),
  MusicData: z
    .object({
      Albums: z.array(z.object({ Count: optNum, TotalCount: optNum })).optional().nullable(),
    })
    .optional()
    .nullable(),
});

const fmt = (n: number) => n.toLocaleString("de-DE");

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
            fullAtMs: b.StoreEnergyRecoverTime,
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

  const motor = d.MotorData;
  const albums = d.MusicData?.Albums ?? [];
  const albumTotal = albums.reduce((s, a) => s + (a.TotalCount ?? 0), 0);
  const boxes = Object.entries(b.Boxes ?? {}).sort(([x], [y]) => Number(x) - Number(y));
  const collection = section("collection", {
    resources: [
      ...(albumTotal
        ? [
            makeResource({
              label: "Musiktitel",
              iconKey: "wuwa/album",
              current: albums.reduce((s, a) => s + (a.Count ?? 0), 0),
              max: albumTotal,
              now,
            }),
          ]
        : []),
      ...(motor?.NextExp
        ? [
            makeResource({
              label: `Fahrzeug bis Stufe ${(motor.Level ?? 0) + 1}`,
              iconKey: "wuwa/vehicle",
              current: motor.Exp ?? 0,
              max: motor.NextExp,
              now,
            }),
          ]
        : []),
    ],
    facts: [
      ...(boxes.length
        ? [
            {
              label: "Geöffnete Schatztruhen",
              value: `${fmt(boxes.reduce((s, [, n]) => s + n, 0))} (Stufe 1–4: ${boxes.map(([, n]) => fmt(n)).join(" · ")})`,
            },
          ]
        : []),
      ...(albums.length
        ? [{ label: "Vollständige Alben", value: `${albums.filter((a) => a.Count === a.TotalCount).length} / ${albums.length}` }]
        : []),
      ...(motor?.Stickers ? [{ label: "Fahrzeug-Sticker", value: fmt(motor.Stickers.length) }] : []),
      ...(motor?.Skins ? [{ label: "Fahrzeug-Skins", value: fmt(motor.Skins.length) }] : []),
    ],
  });

  const accountInfo = section("account", {
    facts: [
      ...(b.Level !== undefined ? [{ label: "Union-Stufe", value: String(b.Level) }] : []),
      ...(b.WorldLevel !== undefined ? [{ label: "Weltstufe", value: String(b.WorldLevel) }] : []),
      ...(b.RoleNum !== undefined ? [{ label: "Resonatoren", value: String(b.RoleNum) }] : []),
      ...(b.ActiveDays !== undefined ? [{ label: "Aktive Tage", value: fmt(b.ActiveDays) }] : []),
      ...(b.CreatTime
        ? [{ label: "Dabei seit", value: new Date(b.CreatTime).toLocaleDateString("de-DE") }]
        : []),
    ],
  });

  // Der Waveplate Crystal steht laut Konzept im Kopf der Detailseite (über `secondary`).
  return {
    game: "wuwa",
    uid: account.uid,
    nickname: b.Name ?? account.nickname ?? account.uid,
    primary: waveplates,
    secondary: crystal,
    tasks: daily.tasks,
    sections: [daily, weekly, collection, accountInfo].filter(nonEmpty),
    characterCount: b.RoleNum,
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
