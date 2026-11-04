import { describe, expect, it } from "vitest";
import type { Banner, VersionFacts } from "../../model/types";
import { parseHoyoAnnouncements } from "./hoyoverse";
import { bannerFacts, mergeVersionFacts } from "./index";
import { parsePhaseEnd, planKuro } from "./kuro";
import { compareVersion, guessNextVersion, parseWikiDate, parseZoned, versionsIn } from "./util";
import { infoboxField, parseVersionPage, wikiFacts } from "./wiki";

const src = { label: "Test", url: "https://example.test" };
const iso = (d: Date | undefined) => d?.toISOString();

describe("util", () => {
  it("erkennt Versionsnummern in Titeln", () => {
    expect(versionsIn("Version 4.7 Store Update")).toEqual(["4.7"]);
    expect(versionsIn("V3.7 Wuthering Waves Battle Rush")).toEqual(["3.7"]);
    expect(versionsIn("Currency Wars: Zero-Sum Game V4.6 Update Details")).toEqual(["4.6"]);
    expect(versionsIn("Upcoming Events")).toEqual([]);
  });

  it("vergleicht Versionen numerisch", () => {
    expect(compareVersion("3.10", "3.9")).toBeGreaterThan(0);
    expect(compareVersion("4.0", "3.8")).toBeGreaterThan(0);
    expect(guessNextVersion("7.2")).toBe("7.3");
  });

  it("rechnet Serverzeit in UTC um", () => {
    expect(iso(parseZoned("2026-12-16 06:00:00", 8))).toBe("2026-12-15T22:00:00.000Z");
    expect(iso(parseZoned("2026-12-15 23:00:00", 1))).toBe("2026-12-15T22:00:00.000Z");
  });

  it("liest die Datumsformate der Wikis", () => {
    expect(iso(parseWikiDate("2026-11-04", 6))).toBe("2026-11-03T22:00:00.000Z");
    expect(iso(parseWikiDate("2026-09-30 11:00", 10))).toBe("2026-09-30T03:00:00.000Z");
    expect(iso(parseWikiDate("October 21, 2026", 6))).toBe("2026-10-20T22:00:00.000Z");
    expect(parseWikiDate("<!--2026-10-01 03:59 ?-->", 6)).toBeUndefined();
  });
});

describe("HoYoverse-Ankündigungen", () => {
  // Auszug aus getAnnList von Star Rail, Region Asien (UTC+8), Stand 4.11.2026
  const starrail = {
    retcode: 0,
    data: {
      timezone: 8,
      list: [
        {
          list: [
            { title: "Version 4.7 Store Update", subtitle: "", start_time: "2026-10-30 20:55:00", end_time: "2026-12-23 06:00:00" },
            { title: 'Version 4.6 "Dance With the Beast Before Moonrise" Update Details', subtitle: "Version 4.6 Update", start_time: "2026-09-28 07:00:00", end_time: "2026-11-11 07:00:00" },
            { title: "Version 4.6 New Stage", subtitle: "", start_time: "2026-09-24 13:30:00", end_time: "2026-11-11 06:00:00" },
            { title: 'Version 4.6 "Nameless Honor" Update', subtitle: "", start_time: "2026-09-25 11:30:00", end_time: "2026-11-09 03:59:00" },
            { title: "Honkai: Star Rail Fair Gaming Declaration", subtitle: "", start_time: "2023-04-04 00:00:00", end_time: "2035-06-07 06:00:00" },
          ],
        },
      ],
    },
  };

  it("findet aktuelle Version, Wartungsbeginn und Folgeversion", () => {
    const f = parseHoyoAnnouncements(starrail, src, new Date("2026-11-04T12:00:00Z"));
    expect(f.current).toBe("4.6");
    expect(iso(f.end)).toBe("2026-11-10T22:00:00.000Z");
    expect(f.next).toBe("4.7");
  });

  it("nimmt bei Genshin das Ende von Update Details ohne Folgeversion", () => {
    const genshin = {
      retcode: 0,
      data: {
        timezone: 8,
        list: [
          {
            list: [
              { title: "New Content Overview", subtitle: "Version 7.2 Now Available", start_time: "2026-11-04 07:00:00", end_time: "2026-12-16 06:00:00" },
              { title: '"Hour of Ruin" Version 7.2 Update Details', subtitle: "Version 7.2 Update Details", start_time: "2026-11-04 07:00:00", end_time: "2026-12-16 06:00:00" },
            ],
          },
        ],
      },
    };
    const f = parseHoyoAnnouncements(genshin, src, new Date("2026-11-04T12:00:00Z"));
    expect(f).toMatchObject({ current: "7.2", next: undefined });
    expect(iso(f.end)).toBe("2026-12-15T22:00:00.000Z");
  });

  it("liefert ohne Update Details keine Version", () => {
    expect(parseHoyoAnnouncements({ retcode: 0, data: { list: [] } }, src).current).toBeUndefined();
  });
});

describe("Kuro Games News", () => {
  const menu = [
    { articleId: 5700, articleTitle: 'Wuthering Waves Version Preview | Version 3.8 "Something" Scheduled for Release on November 12th (UTC+8)', startTime: "2026-11-01 20:20:00" },
    { articleId: 5668, articleTitle: "[Version 3.7 Featured Resonator/Weapon Convene: Phase Ⅱ]", startTime: "2026-10-21 11:15:00" },
    { articleId: 5571, articleTitle: "Patch Notes for Wuthering Waves Version 3.7: Prism's Illusion, Heart's Illumination", startTime: "2026-09-30 10:00:00" },
    { articleId: 5357, articleTitle: "Patch Notes for Version 3.6: Lamplight in Mirage, Sword's Resolve in Heart", startTime: "2026-08-20 10:00:00" },
  ];

  it("nimmt Version aus den Patch Notes und den Beginn der nächsten aus der Vorschau", () => {
    const { facts, phaseTwoId } = planKuro(menu, new Date("2026-11-04T00:00:00Z"));
    expect(facts.current).toBe("3.7");
    expect(iso(facts.start)).toBe("2026-09-30T02:00:00.000Z");
    expect(facts.next).toBe("3.8");
    expect(iso(facts.end)).toBe("2026-11-12T02:00:00.000Z");
    expect(phaseTwoId).toBe(5668);
  });

  it("verweist ohne Vorschau auf den Phase-II-Artikel", () => {
    const { facts, phaseTwoId } = planKuro(menu.slice(1), new Date("2026-11-04T00:00:00Z"));
    expect(facts).toMatchObject({ current: "3.7", next: undefined, end: undefined });
    expect(phaseTwoId).toBe(5668);
  });

  it("liest das Ende aus der Laufzeit des Banners", () => {
    const html = "<p>✦Duration✦</p><p>2026-10-22 10:00 - 2026-11-11 11:59 (server time)</p>";
    expect(iso(parsePhaseEnd(html))).toBe("2026-11-11T03:59:00.000Z");
  });
});

describe("Fandom-Wiki", () => {
  it("ignoriert auskommentierte Felder", () => {
    expect(infoboxField("|next        = <!--3.4-->\n", "next")).toBeUndefined();
    expect(infoboxField("|release_date = 2026-11-11\n|date = x", "release_date", "date")).toBe("2026-11-11");
  });

  it("nimmt die neueste begonnene Version und das Datum der folgenden", () => {
    const pages = [
      parseVersionPage("4.6", "|release_date = 2026-09-28\n|next = 4.7", 6),
      parseVersionPage("4.7", "|release_date = 2026-11-11\n|next = ", 6),
    ];
    const f = wikiFacts(pages, src, new Date("2026-11-04T00:00:00Z"));
    expect(f).toMatchObject({ current: "4.6", next: "4.7" });
    expect(iso(f.end)).toBe("2026-11-10T22:00:00.000Z");
  });
});

describe("Zusammenführen", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const official: VersionFacts = { current: "7.2", start: new Date("2026-11-03T23:00:00Z"), end: new Date("2026-12-15T22:00:00Z"), source: { label: "offiziell", url: "" } };
  const wiki: VersionFacts = { current: "7.2", start: new Date("2026-11-03T22:00:00Z"), next: "7.3", source: { label: "Wiki", url: "" } };

  it("bevorzugt die offizielle Quelle und ergänzt Lücken aus dem Wiki", () => {
    const v = mergeVersionFacts("genshin", [official, wiki], now)!;
    expect(v).toMatchObject({ current: "7.2", next: "7.3", nextGuessed: false, endEstimated: false });
    expect(v.end).toEqual(official.end);
    expect(v.sources.map((s) => s.label)).toEqual(["offiziell", "Wiki"]);
  });

  it("übergeht eine Quelle mit veralteter Version", () => {
    const old: VersionFacts = { current: "7.1", end: new Date("2026-11-03T22:00:00Z"), next: "7.2", source: { label: "alt", url: "" } };
    const v = mergeVersionFacts("genshin", [old, wiki], now)!;
    expect(v.current).toBe("7.2");
    expect(v.sources.map((s) => s.label)).toEqual(["Wiki"]);
  });

  it("schätzt Ende und Folgeversion, wenn keine Quelle sie nennt", () => {
    const v = mergeVersionFacts("zzz", [{ current: "3.3", start: new Date("2026-10-20T22:00:00Z"), source: src }], now)!;
    expect(v).toMatchObject({ next: "3.4", nextGuessed: true, endEstimated: true });
    expect(iso(v.end)).toBe("2026-12-01T22:00:00.000Z");
  });

  it("verwirft ein Ende, das nur die erste Bannerphase abschließt", () => {
    const phaseOne: VersionFacts = { current: "3.3", end: new Date("2026-11-11T03:59:00Z"), source: { label: "Banner", url: "" } };
    const zzzWiki: VersionFacts = { current: "3.3", start: new Date("2026-10-20T22:00:00Z"), source: { label: "Wiki", url: "" } };
    const v = mergeVersionFacts("zzz", [phaseOne, zzzWiki], now)!;
    expect(v.endEstimated).toBe(true);
    expect(iso(v.end)).toBe("2026-12-01T22:00:00.000Z");
    expect(v.sources.map((s) => s.label)).toEqual(["Wiki"]);
  });

  it("nimmt aus dem Banner-Kalender das späteste Ende der laufenden Version", () => {
    const b = (version: string, start: string, end: string): Banner => ({
      id: start + end, name: "x", kind: "character", version, start: new Date(start), end: new Date(end), status: "running", items: [],
    });
    const f = bannerFacts([b("3.3", "2026-10-21T00:00:00Z", "2026-11-11T00:00:00Z"), b("3.3", "2026-11-11T02:00:00Z", "2026-12-01T21:59:59Z"), b("3.3", "2026-10-21T00:00:00Z", "2026-12-01T21:59:59Z")], now)!;
    expect(f.current).toBe("3.3");
    expect(iso(f.end)).toBe("2026-12-01T21:59:59.000Z");
  });
});
