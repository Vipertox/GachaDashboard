import { describe, expect, it } from "vitest";
import { parseWikiBanner, templateParams, wikiDate, wuwaOffset } from "./wuwa";

// Gekürzter Wikitext der echten Seite "Absolute Pulsation: Freeze Frame/2026-10-22" (abgerufen am 3. November 2026).
const WEAPON = `{{Convene
|name              = Absolute Pulsation: Freeze Frame 2026-10-22
|image             = Absolute Pulsation Freeze Frame 2026-10-22.jpg
|type              = Featured Weapon
|duration          = event
|time_start        = 2026-10-22 10:00
|time_end          = 2026-11-11 11:59
|link              = https://wutheringwaves.kurogames.com/en/main/news/detail/5668
|time_start_offset =
|time_end_offset   =
|alongside         = Nine Deaths, One Unbent Heart/2026-10-22
|previous          = Absolute Pulsation: Freeze Frame/2026-06-13
|next              =
}}
{{Intro/Convene|Absolute Pulsation: Freeze Frame/2026-10-22}}

==Details==
* During the event, when a 5-star weapon is obtained, it's guaranteed to be the featured weapon {{Intro/Weapon/Full|Freeze Frame}}.

==Pool==
{{Convene/Pool
|weapon_5_F    = Freeze Frame
|weapon_4_F    = Overture;Relativistic Jet;Amity Accord
|resonator_4   = Yangyang;Chixia;Baizhi
}}

==Change History==
{{Change History|3.7}}`;

const RESONATOR = `{{Convene
|type              = Featured Resonator
|time_start        = 2026-10-22 10:00
|time_end          = 2026-11-11 11:59
}}
{{Convene/Pool
|resonator_5_F = Lucilla
|resonator_4_F = Lumi;Danjin;Chixia
|resonator_5   = Verina;Encore
}}
{{Change History|3.7}}`;

const now = new Date("2026-11-03T12:00:00Z");

describe("Wuthering Waves Banner aus dem Wiki", () => {
  it("liest die Parameter einer Vorlage, ohne verschachtelte Vorlagen zu zerteilen", () => {
    const p = templateParams("{{Convene|a = 1|b = {{X|y}} [[L|z]]\n|c=}}", "Convene");
    expect(p).toEqual({ a: "1", b: "{{X|y}} [[L|z]]", c: "" });
    expect(templateParams(WEAPON, "Convene/Pool")?.weapon_5_F).toBe("Freeze Frame");
    expect(templateParams(WEAPON, "Convene")?.type).toBe("Featured Weapon");
    expect(templateParams(WEAPON, "Fehlt")).toBeUndefined();
    // Sonderzeichen im Namen gelten wörtlich
    expect(templateParams("{{A.B|x=1}}", "A.B")).toEqual({ x: "1" });
    expect(templateParams("{{AxB|x=1}}", "A.B")).toBeUndefined();
  });

  it("rechnet die Serverzeit des Kontos in einen Zeitpunkt um", () => {
    expect(wuwaOffset("America")).toBe(-5);
    expect(wuwaOffset("Europe")).toBe(1);
    expect(wuwaOffset("Asia")).toBe(8);
    expect(wuwaOffset("HMT")).toBe(8);
    // Abgleich mit Gacha Focus: Ende 11:59 Serverzeit je Server
    expect(wikiDate("2026-11-11 11:59", "", "America")?.toISOString()).toBe("2026-11-11T16:59:00.000Z");
    expect(wikiDate("2026-11-11 11:59", "", "Europe")?.toISOString()).toBe("2026-11-11T10:59:00.000Z");
    expect(wikiDate("2026-11-11 11:59", "", "Asia")?.toISOString()).toBe("2026-11-11T03:59:00.000Z");
    // Eine feste Angabe im Wiki gilt vor dem Server des Kontos
    expect(wikiDate("2026-09-30 11:00", "UTC+8", "Europe")?.toISOString()).toBe("2026-09-30T03:00:00.000Z");
    expect(wikiDate("", "", "Europe")).toBeUndefined();
  });

  it("liest Waffen-Banner mit Version, Zeitraum und Waffen", () => {
    const b = parseWikiBanner("Absolute Pulsation: Freeze Frame/2026-10-22", WEAPON, "Europe", now)!;
    expect(b).toMatchObject({
      name: "Absolute Pulsation: Freeze Frame",
      kind: "weapon",
      version: "3.7",
      status: "running",
      sourceUrl: "https://wutheringwaves.fandom.com/wiki/Absolute_Pulsation%3A_Freeze_Frame/2026-10-22",
    });
    expect(b.start?.toISOString()).toBe("2026-10-22T09:00:00.000Z");
    expect(b.items.map((i) => [i.name, i.rarity])).toEqual([
      ["Freeze Frame", 5],
      ["Overture", 4],
      ["Relativistic Jet", 4],
      ["Amity Accord", 4],
    ]);
  });

  it("nimmt bei Figuren-Bannern nur die Figuren mit erhöhter Rate", () => {
    const b = parseWikiBanner("Tomorrow in the Frame/2026-10-22", RESONATOR, "America", now)!;
    expect(b.kind).toBe("character");
    expect(b.items.map((i) => i.name)).toEqual(["Lucilla", "Lumi", "Danjin", "Chixia"]);
  });

  it("überspringt Seiten ohne Ende und kennzeichnet kommende Banner", () => {
    expect(parseWikiBanner("Dauer/2024-05-22", "{{Convene\n|type = Standard\n|time_start = 2024-05-22\n}}", "Europe", now)).toBeUndefined();
    const later = parseWikiBanner("X/2026-11-12", RESONATOR.replace("2026-10-22 10:00", "2026-11-12 10:00"), "Europe", now)!;
    expect(later.status).toBe("upcoming");
  });
});
