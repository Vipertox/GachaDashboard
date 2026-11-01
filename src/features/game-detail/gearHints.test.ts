import { describe, expect, it } from "vitest";
import { gearHints } from "./gearHints";
import { GAME_TERMS } from "../../model/games";
import type { Character, GearPiece } from "../../model/types";

const piece = (slot: number, setName: string, level = 20): GearPiece => ({
  slot,
  name: `Teil ${slot}`,
  setName,
  rarity: 5,
  level,
  maxLevel: 20,
  subStats: [],
});

const fourPlusOne = [1, 2, 3, 4].map((s) => piece(s, "Hexerei")).concat(piece(5, "Gladiator"));

function char(part: Partial<Character>): Character {
  return {
    id: "1",
    name: "Test",
    element: "pyro",
    rarity: 5,
    level: 90,
    dupes: 0,
    weapon: { name: "Schwert", rarity: 5, level: 90, refinement: 1 },
    gear: fourPlusOne,
    sets: [
      { name: "Hexerei", count: 4, bonuses: [{ pieces: 2 }, { pieces: 4 }] },
      { name: "Gladiator", count: 1, bonuses: [{ pieces: 2 }, { pieces: 4 }] },
    ],
    skills: [],
    stats: [],
    moreStats: [],
    ...part,
  };
}

describe("gearHints", () => {
  const terms = GAME_TERMS.genshin;

  it("meldet nichts bei vollständiger 4+1-Ausrüstung", () => {
    expect(gearHints(char({}), terms)).toEqual([]);
  });

  it("meldet leere Plätze mit Namen", () => {
    const gear = fourPlusOne.filter((g) => g.slot !== 4);
    expect(gearHints(char({ gear }), terms)).toContain("Platz leer: Kelch");
  });

  it("meldet ein Set mit drei Teilen, aber nicht mit einem", () => {
    const sets = [
      { name: "Hexerei", count: 3, bonuses: [{ pieces: 2 }, { pieces: 4 }] },
      { name: "Gladiator", count: 2, bonuses: [{ pieces: 2 }, { pieces: 4 }] },
    ];
    expect(gearHints(char({ sets }), terms)).toEqual(["Set unvollständig: Hexerei (3/4)"]);
  });

  it("zählt nicht ausgebaute Teile", () => {
    const gear = fourPlusOne.map((g) => (g.slot <= 2 ? { ...g, level: 16 } : g));
    expect(gearHints(char({ gear }), terms)).toContain("2 Teile nicht ausgebaut");
  });

  it("meldet eine Waffe unter Figurenstufe und eine fehlende Waffe", () => {
    expect(gearHints(char({ weapon: { name: "S", rarity: 4, level: 80, refinement: 5 } }), terms)).toContain(
      "Waffe unter Figurenstufe (80/90)",
    );
    expect(gearHints(char({ weapon: undefined }), GAME_TERMS.zzz)).toContain("Keine W-Engine angelegt");
  });
});
