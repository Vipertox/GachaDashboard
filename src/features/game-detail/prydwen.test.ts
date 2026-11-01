import { describe, expect, it } from "vitest";
import { prydwenUrl, slugify } from "./prydwen";
import type { CharacterSummary } from "../../model/types";

const char = (id: string, name: string, element = ""): CharacterSummary => ({ id, name, element, rarity: 5, level: 90, dupes: 0 });

describe("slugify", () => {
  it("entfernt Akzente, ß und Sonderzeichen", () => {
    expect(slugify("Große Herta")).toBe("grosse-herta");
    expect(slugify("Dan Heng • Imbibitor Lunae")).toBe("dan-heng-imbibitor-lunae");
    expect(slugify("Äonin ★ Aha")).toBe("aonin-aha");
  });
});

describe("prydwenUrl", () => {
  it("baut die URL aus dem Namen", () => {
    expect(prydwenUrl("genshin", char("10000046", "Hu Tao"))).toBe("https://www.prydwen.gg/genshin-impact/characters/hu-tao");
    expect(prydwenUrl("starrail", char("1407", "Castorice"))).toBe("https://www.prydwen.gg/star-rail/characters/castorice");
    expect(prydwenUrl("zzz", char("1191", "Ellen"))).toBe("https://www.prydwen.gg/zenless/characters/ellen");
  });

  it("übersetzt deutsche Namen, die Prydwen anders schreibt", () => {
    expect(prydwenUrl("genshin", char("10000052", "Shougun Raiden"))).toBe("https://www.prydwen.gg/genshin-impact/characters/raiden-shogun");
    expect(prydwenUrl("starrail", char("1006", "Silberwolf"))).toBe("https://www.prydwen.gg/star-rail/characters/silver-wolf");
    expect(prydwenUrl("starrail", char("1213", "Dan Heng • Imbibitor Lunae"))).toBe(
      "https://www.prydwen.gg/star-rail/characters/imbibitor-lunae",
    );
  });

  it("wählt die Seite des Reisenden nach Element und des Trailblazers nach Pfad", () => {
    expect(prydwenUrl("genshin", char("10000007", "Reisende", "dendro"))).toBe(
      "https://www.prydwen.gg/genshin-impact/characters/traveler-dendro",
    );
    expect(prydwenUrl("starrail", char("8006", "Trailblazer"))).toBe("https://www.prydwen.gg/star-rail/characters/trailblazer-harmony");
  });

  it("liefert nichts für Wuthering Waves und leere Namen", () => {
    expect(prydwenUrl("wuwa", char("1", "Jinhsi"))).toBeUndefined();
    expect(prydwenUrl("genshin", char("1", "★"))).toBeUndefined();
  });
});
