import { z } from "zod";
import { fetchWithCredentials } from "../adapters/credentialsForAccount";
import { num, optNum, parseOrThrow } from "../adapters/util";
import { hoyoPost } from "../hoyolab";
import { groupSets, optStr, propertyNames, splitStats, stat, str, type PropertyNames } from "./util";
import type { Account, Character, CharacterAdapter, CharacterSummary, GearPiece } from "../../model/types";

const BASE = "https://bbs-api-os.hoyolab.com/game_record/genshin/api";

const weaponBrief = z
  .object({
    name: str,
    icon: optStr,
    rarity: optNum,
    level: optNum,
    affix_level: optNum,
  })
  .nullable()
  .optional();

const base = z.object({
  id: str,
  name: str,
  element: optStr,
  rarity: optNum,
  level: optNum,
  actived_constellation_num: optNum,
  icon: optStr,
  image: optStr,
  weapon: weaponBrief,
});

const listSchema = z.object({ list: z.array(base) });

const prop = z.object({
  property_type: z.union([z.string(), z.number()]).optional().nullable(),
  value: z.union([z.string(), z.number()]).optional().nullable(),
  final: z.union([z.string(), z.number()]).optional().nullable(),
  times: optNum,
});

const detailSchema = z.object({
  list: z.array(
    z.object({
      base,
      weapon: z
        .object({
          name: str,
          icon: optStr,
          rarity: optNum,
          level: optNum,
          affix_level: optNum,
          main_property: prop.nullable().optional(),
          sub_property: prop.nullable().optional(),
        })
        .nullable()
        .optional(),
      relics: z
        .array(
          z.object({
            pos: num,
            name: str,
            icon: optStr,
            rarity: optNum,
            level: optNum,
            set: z
              .object({
                name: str,
                affixes: z.array(z.object({ activation_number: num, effect: optStr })).optional().nullable(),
              })
              .nullable()
              .optional(),
            main_property: prop.nullable().optional(),
            sub_property_list: z.array(prop).optional().nullable(),
          }),
        )
        .optional()
        .nullable(),
      skills: z
        .array(z.object({ skill_type: optNum, level: optNum, name: optStr }))
        .optional()
        .nullable(),
      selected_properties: z.array(prop).optional().nullable(),
      base_properties: z.array(prop).optional().nullable(),
      extra_properties: z.array(prop).optional().nullable(),
      element_properties: z.array(prop).optional().nullable(),
    }),
  ),
  property_map: z.record(z.string(), z.object({ name: optStr }).passthrough()).optional().nullable(),
});

const RELIC_MAX: Record<number, number> = { 5: 20, 4: 16, 3: 12, 2: 4, 1: 4 };

// HP, ATK, DEF, Elementarkunde, Krit. Rate, Krit. Schaden, Aufladerate
const MAIN_STATS = ["2000", "2001", "2002", "28", "20", "22", "23"];

function summary(b: z.infer<typeof base>): CharacterSummary {
  return {
    id: b.id,
    name: b.name,
    element: (b.element ?? "").toLowerCase(),
    rarity: b.rarity ?? 0,
    level: b.level ?? 0,
    dupes: b.actived_constellation_num ?? 0,
    iconUrl: b.icon ?? undefined,
    weapon: b.weapon
      ? {
          name: b.weapon.name,
          iconUrl: b.weapon.icon ?? undefined,
          rarity: b.weapon.rarity ?? 0,
          refinement: b.weapon.affix_level ?? 1,
        }
      : undefined,
  };
}

export function parseGenshinRoster(data: unknown): CharacterSummary[] {
  return parseOrThrow(listSchema, data).list.map(summary);
}

type Prop = z.infer<typeof prop>;
const propValue = (names: PropertyNames, p: Prop) => stat(names, p.property_type, p.final ?? p.value);

export function parseGenshinDetails(data: unknown): Character[] {
  const d = parseOrThrow(detailSchema, data);
  const names = propertyNames(d.property_map);
  return d.list.map((c) => {
    const gear: GearPiece[] = (c.relics ?? [])
      .map((r) => ({
        slot: r.pos,
        name: r.name,
        setName: r.set?.name,
        iconUrl: r.icon ?? undefined,
        rarity: r.rarity ?? 0,
        level: r.level ?? 0,
        maxLevel: RELIC_MAX[r.rarity ?? 5] ?? 20,
        mainStat: r.main_property ? propValue(names, r.main_property) : undefined,
        // Genshin zählt in `times` nur die Erhöhungen, 0 = Startwert. Beim Durchstich prüfen.
        subStats: (r.sub_property_list ?? []).map((p) => stat(names, p.property_type, p.value, p.times)),
      }))
      .sort((a, b) => a.slot - b.slot);
    const affixes = new Map((c.relics ?? []).map((r) => [r.set?.name, r.set?.affixes ?? []]));
    const all = [
      ...(c.base_properties ?? []),
      ...(c.extra_properties ?? []),
      ...(c.element_properties ?? []),
    ].map((p) => propValue(names, p));
    const w = c.weapon;
    return {
      ...summary(c.base),
      imageUrl: c.base.image ?? undefined,
      weapon: w
        ? {
            name: w.name,
            iconUrl: w.icon ?? undefined,
            rarity: w.rarity ?? 0,
            level: w.level ?? 0,
            refinement: w.affix_level ?? 1,
            mainStat: w.main_property ? propValue(names, w.main_property) : undefined,
            subStat: w.sub_property ? propValue(names, w.sub_property) : undefined,
          }
        : undefined,
      gear,
      sets: groupSets(gear, (name) =>
        (affixes.get(name) ?? []).map((a) => ({ pieces: a.activation_number, text: a.effect ?? undefined })),
      ),
      // skill_type 1 sind die drei aktiven Talente, 2 die passiven.
      skills: (c.skills ?? [])
        .filter((s) => s.skill_type === 1)
        .map((s) => ({ label: s.name ?? "Talent", level: s.level ?? 0 })),
      ...splitStats(all, MAIN_STATS),
    };
  });
}

function body(account: Account) {
  return { role_id: account.uid, server: account.region };
}

export const genshinCharacters: CharacterAdapter = {
  game: "genshin",
  prefetchDetails: true,
  fetchRoster: (account, signal) =>
    fetchWithCredentials(account, async (creds) => ({
      characters: parseGenshinRoster(await hoyoPost(`${BASE}/character/list`, creds, body(account), signal)),
    })),
  fetchDetails: (account, ids, signal) =>
    fetchWithCredentials(account, async (creds) =>
      parseGenshinDetails(
        await hoyoPost(`${BASE}/character/detail`, creds, { ...body(account), character_ids: ids.map(Number) }, signal),
      ),
    ),
};
