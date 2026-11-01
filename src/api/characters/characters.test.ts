import { describe, expect, it } from "vitest";
import { parseGenshinDetails, parseGenshinRoster } from "./genshin";
import { parseStarRailCharacters } from "./starrail";
import { parseZzzDetails, parseZzzRoster } from "./zzz";
import { fmtValue } from "./util";

// Fixtures nach den Feldnamen aus genshin.py, gekürzt. Beim Durchstich durch echte Antworten ersetzen.

const genshinBase = {
  id: 10000046,
  name: "Hu Tao",
  element: "Pyro",
  rarity: 5,
  level: 90,
  actived_constellation_num: 1,
  icon: "https://example.test/hutao.png",
  weapon: { name: "Stab der Homa", icon: "w.png", rarity: 5, level: 90, affix_level: 1 },
};

describe("Genshin", () => {
  it("liest die Liste", () => {
    const [c] = parseGenshinRoster({ list: [genshinBase] });
    expect(c).toMatchObject({ id: "10000046", element: "pyro", dupes: 1, weapon: { refinement: 1 } });
  });

  it("liest Artefakte, Sets und Werte", () => {
    const relic = (pos: number, set: string) => ({
      pos,
      name: `Artefakt ${pos}`,
      rarity: 5,
      level: 20,
      set: { name: set, affixes: [{ activation_number: 2, effect: "Pyro +15%" }, { activation_number: 4, effect: "…" }] },
      main_property: { property_type: 2000, value: "4780" },
      sub_property_list: [{ property_type: 20, value: "10.5%", times: 2 }],
    });
    const [c] = parseGenshinDetails({
      list: [
        {
          base: genshinBase,
          weapon: {
            name: "Stab der Homa",
            rarity: 5,
            level: 90,
            affix_level: 1,
            main_property: { property_type: 2001, final: "608" },
            sub_property: { property_type: 22, final: "66.2%" },
          },
          relics: [relic(2, "Hexerei"), relic(1, "Hexerei")],
          skills: [
            { skill_type: 1, level: 10, name: "Normaler Angriff" },
            { skill_type: 2, level: 1, name: "Passiv" },
          ],
          base_properties: [{ property_type: 2000, final: "34000" }, { property_type: 20, final: "62.4%" }],
          extra_properties: [{ property_type: 26, final: "0%" }],
        },
      ],
      property_map: { "2000": { name: "LP" }, "20": { name: "Krit. Rate" }, "22": { name: "Krit. Schaden" } },
    });
    expect(c.gear.map((g) => g.slot)).toEqual([1, 2]);
    expect(c.gear[0].subStats[0]).toEqual({ key: "20", label: "Krit. Rate", value: "10,5%", rolls: 2 });
    expect(c.sets).toEqual([
      { name: "Hexerei", count: 2, bonuses: [{ pieces: 2, text: "Pyro +15%" }, { pieces: 4, text: "…" }] },
    ]);
    expect(c.skills).toEqual([{ label: "Normaler Angriff", level: 10 }]);
    expect(c.stats.map((s) => s.label)).toEqual(["LP", "Krit. Rate"]);
    expect(c.moreStats[0].label).toBe("Wert 26");
    expect(c.weapon?.subStat?.value).toBe("66,2%");
  });
});

describe("Star Rail", () => {
  it("liest Relikte, Ornamente, Pfad und Memosprite", () => {
    const [c] = parseStarRailCharacters({
      avatar_list: [
        {
          id: 1407,
          name: "Castorice",
          element: "Quantum",
          base_type: 8,
          rarity: 5,
          level: 80,
          rank: 0,
          equip: { name: "Lichtkegel", rarity: 5, level: 80, rank: 1 },
          relics: [{ pos: 1, name: "Kopf", rarity: 5, level: 15, main_property: { property_type: 1, value: "705" }, properties: [{ property_type: 5, value: "3.2%", times: 3 }] }],
          ornaments: [{ pos: 5, name: "Sphäre", rarity: 5, level: 12, properties: [] }],
          skills: [{ point_type: 2, anchor: "Point03", level: 10, skill_stages: [{ name: "Ult" }] }],
          properties: [{ property_type: 1, final: "8000" }, { property_type: 9, final: "100%" }],
          servant_detail: { servant_name: "Pollux" },
        },
      ],
      property_info: { "1": { name: "LP" }, "5": { name: "Krit. Rate" } },
    });
    expect(c).toMatchObject({ element: "quantum", role: "8", dupes: 0, companion: { name: "Pollux" } });
    expect(c.gear.map((g) => g.slot)).toEqual([1, 5]);
    expect(c.gear[0].subStats[0].rolls).toBe(2);
    expect(c.gear[1].level).toBeLessThan(c.gear[1].maxLevel);
    expect(c.skills).toEqual([{ label: "Ult", level: 10 }]);
    expect(c.stats.map((s) => s.label)).toEqual(["LP"]);
  });
});

describe("ZZZ", () => {
  const basic = { id: 1191, name_mi18n: "Ellen", element_type: 202, avatar_profession: 1, rarity: "S", level: 60, rank: 2 };

  it("liest die Liste mit Buchstaben-Seltenheit", () => {
    expect(parseZzzRoster({ avatar_list: [basic] })[0]).toMatchObject({ rarity: 5, element: "ice", role: "1", dupes: 2 });
  });

  it("liest Drive Discs mit Set-Boni", () => {
    const disc = (t: number) => ({
      equipment_type: t,
      name: `Disc ${t}`,
      rarity: "S",
      level: 15,
      main_properties: [{ property_name: "ANG", property_id: 12102, base: "316" }],
      properties: [{ property_name: "Krit. Rate", property_id: 20103, base: "4.8%", add: 2 }],
      equip_suit: { name: "Polar-Metal", desc1: "Eis +10%", desc2: "…" },
    });
    const [c] = parseZzzDetails({
      avatar_list: [
        {
          ...basic,
          weapon: { name: "Tiefsee-Besucher", rarity: "S", level: 60, star: 1, main_properties: [{ property_name: "ANG", base: "713" }] },
          equip: [disc(3), disc(1), disc(2)],
          skills: [{ skill_type: 5, level: 7 }, { skill_type: 0, level: 12 }],
          properties: Array.from({ length: 8 }, (_, i) => ({ property_name: `W${i}`, property_id: i, final: "1" })),
        },
      ],
    });
    expect(c.gear.map((g) => g.slot)).toEqual([1, 2, 3]);
    expect(c.sets[0]).toMatchObject({ name: "Polar-Metal", count: 3 });
    expect(c.gear[0].subStats[0]).toMatchObject({ value: "4,8%", rolls: 2 });
    expect(c.skills.map((s) => s.label)).toEqual(["Normaler Angriff", "Kernfertigkeit"]);
    expect(c.stats).toHaveLength(6);
    expect(c.moreStats).toHaveLength(2);
    expect(c.weapon?.mainStat?.value).toBe("713");
  });
});

describe("fmtValue", () => {
  it("setzt Dezimalkomma und ersetzt leere Werte", () => {
    expect(fmtValue("46.6%")).toBe("46,6%");
    expect(fmtValue(1200)).toBe("1200");
    expect(fmtValue(undefined)).toBe("–");
  });
});
