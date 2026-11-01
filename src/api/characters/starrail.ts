import { z } from "zod";
import { fetchWithCredentials } from "../adapters/credentialsForAccount";
import { num, optNum, parseOrThrow } from "../adapters/util";
import { hoyoGet } from "../hoyolab";
import { optStr, propertyNames, splitStats, stat, str } from "./util";
import type { Character, CharacterAdapter, GearPiece } from "../../model/types";

const value = z.union([z.string(), z.number()]).optional().nullable();
const prop = z.object({
  property_type: value,
  value,
  base: value,
  add: value,
  final: value,
  times: optNum,
});

const piece = z.object({
  pos: num,
  name: str,
  icon: optStr,
  rarity: optNum,
  level: optNum,
  main_property: prop.nullable().optional(),
  properties: z.array(prop).optional().nullable(),
});

const schema = z.object({
  avatar_list: z.array(
    z.object({
      id: str,
      name: str,
      element: optStr,
      base_type: value,
      rarity: optNum,
      level: optNum,
      rank: optNum,
      icon: optStr,
      image: optStr,
      equip: z
        .object({ name: str, icon: optStr, rarity: optNum, level: optNum, rank: optNum })
        .nullable()
        .optional(),
      relics: z.array(piece).optional().nullable(),
      ornaments: z.array(piece).optional().nullable(),
      properties: z.array(prop).optional().nullable(),
      skills: z
        .array(
          z.object({
            point_type: optNum,
            anchor: optStr,
            level: optNum,
            skill_stages: z.array(z.object({ name: optStr })).optional().nullable(),
          }),
        )
        .optional()
        .nullable(),
      servant_detail: z
        .object({ servant_name: optStr, servant_icon: optStr })
        .nullable()
        .optional(),
    }),
  ),
  // genshin.py nennt das Feld property_info, ältere Antworten property_map.
  property_info: z.record(z.string(), z.object({ name: optStr }).passthrough()).optional().nullable(),
  property_map: z.record(z.string(), z.object({ name: optStr }).passthrough()).optional().nullable(),
});

const RELIC_MAX: Record<number, number> = { 5: 15, 4: 12, 3: 9, 2: 6 };

// HP, ANG, VER, Tempo, Krit. Rate, Krit. Schaden
const MAIN_STATS = ["1", "2", "3", "4", "5", "6"];

// Point01–04: Normaler Angriff, Fähigkeit, Ultimative Fähigkeit, Talent
const SKILL_ANCHORS = ["Point01", "Point02", "Point03", "Point04"];
const SKILL_FALLBACK = ["Normaler Angriff", "Fähigkeit", "Ultimative", "Talent"];

export function parseStarRailCharacters(data: unknown): Character[] {
  const d = parseOrThrow(schema, data);
  const names = { ...propertyNames(d.property_map), ...propertyNames(d.property_info) };
  return d.avatar_list.map((a) => {
    const gear: GearPiece[] = [...(a.relics ?? []), ...(a.ornaments ?? [])]
      .map((r) => ({
        slot: r.pos,
        name: r.name,
        iconUrl: r.icon ?? undefined,
        rarity: r.rarity ?? 0,
        level: r.level ?? 0,
        maxLevel: RELIC_MAX[r.rarity ?? 5] ?? 15,
        mainStat: r.main_property ? stat(names, r.main_property.property_type, r.main_property.value) : undefined,
        // Star Rail zählt den Startwert in `times` mit. Beim Durchstich prüfen.
        subStats: (r.properties ?? []).map((p) => stat(names, p.property_type, p.value, (p.times ?? 1) - 1)),
      }))
      .sort((x, y) => x.slot - y.slot);
    const equip = a.equip;
    return {
      id: a.id,
      name: a.name,
      element: (a.element ?? "").toLowerCase(),
      role: a.base_type != null ? String(a.base_type) : undefined,
      rarity: a.rarity ?? 0,
      level: a.level ?? 0,
      dupes: a.rank ?? 0,
      iconUrl: a.icon ?? undefined,
      imageUrl: a.image ?? undefined,
      weapon: equip
        ? {
            name: equip.name,
            iconUrl: equip.icon ?? undefined,
            rarity: equip.rarity ?? 0,
            level: equip.level ?? 0,
            refinement: equip.rank ?? 1,
          }
        : undefined,
      gear,
      // Die Antwort enthält keine Set-Namen, nur Namen der einzelnen Teile.
      sets: [],
      skills: SKILL_ANCHORS.flatMap((anchor, i) => {
        const s = (a.skills ?? []).find((x) => x.point_type === 2 && x.anchor === anchor);
        return s ? [{ label: s.skill_stages?.[0]?.name ?? SKILL_FALLBACK[i], level: s.level ?? 0 }] : [];
      }),
      ...splitStats(
        (a.properties ?? []).map((p) => stat(names, p.property_type, p.final ?? p.value)),
        MAIN_STATS,
      ),
      companion: a.servant_detail?.servant_name
        ? { name: a.servant_detail.servant_name, iconUrl: a.servant_detail.servant_icon ?? undefined }
        : undefined,
    };
  });
}

export const starrailCharacters: CharacterAdapter = {
  game: "starrail",
  prefetchDetails: true,
  // Ein Aufruf liefert Liste und alle Details.
  fetchRoster: (account, signal) =>
    fetchWithCredentials(account, async (creds) => {
      const details = parseStarRailCharacters(
        await hoyoGet(
          `https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/avatar/info?server=${account.region}&role_id=${account.uid}&need_wiki=true`,
          creds,
          signal,
        ),
      );
      return { characters: details, details };
    }),
  fetchDetails: async (account, ids, signal) => {
    const { details } = await starrailCharacters.fetchRoster(account, signal);
    return (details ?? []).filter((c) => ids.includes(c.id));
  },
};
