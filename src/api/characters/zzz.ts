import { z } from "zod";
import { fetchWithCredentials } from "../adapters/credentialsForAccount";
import { num, optNum, parseOrThrow } from "../adapters/util";
import { hoyoGet } from "../hoyolab";
import { fmtValue, groupSets, optStr, str } from "./util";
import type { Account, Character, CharacterAdapter, CharacterSummary, GearPiece, Stat } from "../../model/types";

const BASE = "https://sg-act-nap-api.hoyolab.com/event/game_record_zzz/api/zzz";

// ZZZ liefert Seltenheiten als Buchstaben.
const RARITY: Record<string, number> = { S: 5, A: 4, B: 3 };
const ELEMENT: Record<string, string> = {
  "200": "physical",
  "201": "fire",
  "202": "ice",
  "203": "electric",
  "205": "ether",
};
const DISC_MAX: Record<number, number> = { 5: 15, 4: 12, 3: 9 };
const SKILL_LABEL: Record<number, string> = {
  0: "Normaler Angriff",
  1: "Spezialangriff",
  2: "Ausweichen",
  3: "Kettenangriff",
  5: "Kernfertigkeit",
  6: "Unterstützung",
};
const SKILL_ORDER = [0, 2, 6, 1, 3, 5];

const rarity = z.union([z.string(), z.number()]).optional().nullable();
const toRarity = (r: string | number | null | undefined) =>
  typeof r === "number" ? r : (RARITY[String(r ?? "").toUpperCase()] ?? 0);

const prop = z.object({
  property_name: optStr,
  property_id: z.union([z.string(), z.number()]).optional().nullable(),
  base: z.union([z.string(), z.number()]).optional().nullable(),
  final: z.union([z.string(), z.number()]).optional().nullable(),
  // Bei Disc-Nebenwerten die Anzahl der Erhöhungen, bei Figurenwerten der Bonus.
  add: z.union([z.string(), z.number()]).optional().nullable(),
});

const toStat = (p: z.infer<typeof prop>): Stat => ({
  key: String(p.property_id ?? p.property_name ?? ""),
  label: p.property_name ?? `Wert ${p.property_id ?? "?"}`,
  value: fmtValue(p.final || p.base),
});

const toSubStat = (p: z.infer<typeof prop>): Stat => {
  const rolls = Number(p.add);
  return { ...toStat(p), rolls: rolls > 0 ? rolls : undefined };
};

const basic = z.object({
  id: str,
  name_mi18n: optStr,
  full_name_mi18n: optStr,
  element_type: z.union([z.string(), z.number()]).optional().nullable(),
  avatar_profession: z.union([z.string(), z.number()]).optional().nullable(),
  rarity,
  level: optNum,
  rank: optNum,
  role_square_url: optStr,
  hollow_icon_path: optStr,
  group_icon_path: optStr,
});

const weapon = z
  .object({
    name: str,
    icon: optStr,
    rarity,
    level: optNum,
    star: optNum,
    main_properties: z.array(prop).optional().nullable(),
    properties: z.array(prop).optional().nullable(),
  })
  .nullable()
  .optional();

const basicSchema = z.object({ avatar_list: z.array(basic) });

const infoSchema = z.object({
  avatar_list: z.array(
    basic.extend({
      role_vertical_painting_url: optStr,
      weapon,
      equip: z
        .array(
          z.object({
            equipment_type: num,
            name: str,
            icon: optStr,
            rarity,
            level: optNum,
            main_properties: z.array(prop).optional().nullable(),
            properties: z.array(prop).optional().nullable(),
            equip_suit: z.object({ name: str, desc1: optStr, desc2: optStr }).nullable().optional(),
          }),
        )
        .optional()
        .nullable(),
      properties: z.array(prop).optional().nullable(),
      skills: z.array(z.object({ skill_type: optNum, level: optNum })).optional().nullable(),
    }),
  ),
});

function summary(a: z.infer<typeof basic>, w?: z.infer<typeof weapon>): CharacterSummary {
  return {
    id: a.id,
    name: a.name_mi18n ?? a.full_name_mi18n ?? a.id,
    element: ELEMENT[String(a.element_type ?? "")] ?? "",
    role: a.avatar_profession != null ? String(a.avatar_profession) : undefined,
    rarity: toRarity(a.rarity),
    level: a.level ?? 0,
    dupes: a.rank ?? 0,
    // Welches Bildfeld die API sicher liefert, ist beim Durchstich zu prüfen.
    iconUrl: a.role_square_url ?? a.hollow_icon_path ?? a.group_icon_path ?? undefined,
    weapon: w
      ? { name: w.name, iconUrl: w.icon ?? undefined, rarity: toRarity(w.rarity), refinement: w.star ?? 1 }
      : undefined,
  };
}

export function parseZzzRoster(data: unknown): CharacterSummary[] {
  return parseOrThrow(basicSchema, data).avatar_list.map((a) => summary(a));
}

export function parseZzzDetails(data: unknown): Character[] {
  return parseOrThrow(infoSchema, data).avatar_list.map((a) => {
    const gear: GearPiece[] = (a.equip ?? [])
      .map((e) => {
        const r = toRarity(e.rarity);
        const main = e.main_properties?.[0];
        return {
          slot: e.equipment_type,
          name: e.name,
          setName: e.equip_suit?.name,
          iconUrl: e.icon ?? undefined,
          rarity: r,
          level: e.level ?? 0,
          maxLevel: DISC_MAX[r] ?? 15,
          mainStat: main ? toStat(main) : undefined,
          subStats: (e.properties ?? []).map(toSubStat),
        };
      })
      .sort((x, y) => x.slot - y.slot);
    const suits = new Map((a.equip ?? []).map((e) => [e.equip_suit?.name, e.equip_suit]));
    const w = a.weapon;
    const stats = (a.properties ?? []).map(toStat);
    return {
      ...summary(a, w),
      imageUrl: a.role_vertical_painting_url ?? undefined,
      weapon: w
        ? {
            name: w.name,
            iconUrl: w.icon ?? undefined,
            rarity: toRarity(w.rarity),
            level: w.level ?? 0,
            refinement: w.star ?? 1,
            mainStat: w.main_properties?.[0] ? toStat(w.main_properties[0]) : undefined,
            subStat: w.properties?.[0] ? toStat(w.properties[0]) : undefined,
          }
        : undefined,
      gear,
      sets: groupSets(gear, (name) => {
        const s = suits.get(name);
        return [
          { pieces: 2, text: s?.desc1 ?? undefined },
          { pieces: 4, text: s?.desc2 ?? undefined },
        ];
      }),
      skills: SKILL_ORDER.flatMap((t) => {
        const s = (a.skills ?? []).find((x) => x.skill_type === t);
        return s ? [{ label: SKILL_LABEL[t], level: s.level ?? 0 }] : [];
      }),
      // Die API liefert HP, ANG, VER, Wucht, Krit. Rate und Krit. Schaden zuerst.
      stats: stats.slice(0, 6),
      moreStats: stats.slice(6),
    };
  });
}

function query(account: Account) {
  return `server=${account.region}&role_id=${account.uid}`;
}

export const zzzCharacters: CharacterAdapter = {
  game: "zzz",
  // avatar/info nimmt nur eine ID pro Aufruf (sonst retcode -400005), daher erst beim Antippen laden.
  prefetchDetails: false,
  fetchRoster: (account, signal) =>
    fetchWithCredentials(account, async (creds) => ({
      characters: parseZzzRoster(await hoyoGet(`${BASE}/avatar/basic?${query(account)}`, creds, signal)),
    })),
  fetchDetails: (account, ids, signal) =>
    fetchWithCredentials(account, async (creds) => {
      const out: Character[] = [];
      for (const id of ids) {
        const data = await hoyoGet(
          `${BASE}/avatar/info?${query(account)}&id_list[]=${encodeURIComponent(id)}&need_wiki=true`,
          creds,
          signal,
        );
        out.push(...parseZzzDetails(data));
      }
      return out;
    }),
};
