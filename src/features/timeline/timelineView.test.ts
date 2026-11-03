import { describe, expect, it } from "vitest";
import { barSpan, dayTicks, endingSoon, fromCalendar, fromChallenge, itemOrder, timelineWindow, type TimelineItem } from "./timelineView";
import type { Challenge, ChallengeMode } from "../../model/types";

// Lokale Zeit, damit die Tagesgrenzen unabhängig von der Zeitzone des Testrechners stimmen.
const at = (day: number, hour = 12) => new Date(2026, 10, day, hour);
const now = at(10).getTime();

const item = (name: string, start?: number, end?: number, status: TimelineItem["status"] = "running"): TimelineItem => ({
  key: name,
  kind: "event",
  game: "genshin",
  name,
  start: start === undefined ? undefined : at(start),
  end: end === undefined ? undefined : at(end),
  status,
  icons: [],
  source: { type: "challenge", mode: name },
});

describe("Zeitraum", () => {
  it("beginnt drei Tage vor heute und reicht bis zum spätesten Ende", () => {
    const win = timelineWindow([item("a", 5, 30)], now);
    expect(new Date(win.from)).toEqual(new Date(2026, 10, 7));
    expect(win.days).toBe(24);
    expect(new Date(win.to)).toEqual(new Date(2026, 11, 1));
  });

  it("hat mindestens 14 und höchstens 42 Tage", () => {
    expect(timelineWindow([item("a", 9, 11)], now).days).toBe(14);
    expect(timelineWindow([item("a", 9, 200)], now).days).toBe(42);
    expect(timelineWindow([], now).days).toBe(14);
  });

  it("liefert einen Strich pro Tag", () => {
    const win = timelineWindow([], now);
    const ticks = dayTicks(win);
    expect(ticks).toHaveLength(14);
    expect(new Date(ticks[1])).toEqual(new Date(2026, 10, 8));
  });
});

describe("Balken", () => {
  const win = timelineWindow([], now); // 07.11. bis 21.11.

  it("liegt anteilig im Zeitraum", () => {
    const s = barSpan({ start: new Date(2026, 10, 14), end: new Date(2026, 10, 21) }, win)!;
    expect(s.left).toBeCloseTo(0.5);
    expect(s.width).toBeCloseTo(0.5);
    expect(s).toMatchObject({ openStart: false, openEnd: false });
  });

  it("wird an den Rändern abgeschnitten, auch ohne Datum", () => {
    expect(barSpan({ start: at(1), end: at(30) }, win)).toMatchObject({ left: 0, width: 1, openStart: true, openEnd: true });
    expect(barSpan({}, win)).toMatchObject({ left: 0, width: 1, openStart: true, openEnd: true });
  });

  it("fehlt außerhalb des Zeitraums", () => {
    expect(barSpan({ start: at(1), end: at(5) }, win)).toBeUndefined();
    expect(barSpan({ start: at(25), end: at(30) }, win)).toBeUndefined();
  });

  it("sortiert nach Beginn, dann Ende, dann Name", () => {
    const list = [item("c", 8, 20), item("b", 8, 12), item("a", undefined, 30), item("d", 8, 12)];
    expect(list.sort(itemOrder).map((i) => i.name)).toEqual(["a", "b", "d", "c"]);
  });

  it("endet bald nur, wenn er läuft und weniger als drei Tage bleiben", () => {
    expect(endingSoon(item("a", 1, 12), now)).toBe(true);
    expect(endingSoon(item("a", 1, 20), now)).toBe(false);
    expect(endingSoon(item("a", 1, 12, "done"), now)).toBe(false);
  });
});

describe("Quellen", () => {
  it("zeigt bei Bannern nur die höchste Seltenheit", () => {
    const [b] = fromCalendar("genshin", {
      events: [],
      banners: [
        {
          id: "1",
          name: "Gebet",
          kind: "character",
          version: "6.2",
          status: "running",
          items: [
            { name: "Furina", rarity: 5, iconUrl: "f" },
            { name: "Bennett", rarity: 4 },
          ],
        },
      ],
    });
    expect(b).toMatchObject({ kind: "banner", note: "Version 6.2", icons: [{ url: "f", label: "Furina" }] });
  });

  it("übernimmt Kennzeichen und Fortschritt der Events, bei kommenden ohne Fortschritt", () => {
    const items = fromCalendar("genshin", {
      events: [
        { id: "a", name: "A", status: "running", tag: "Doppelt", progress: { current: 1, max: 4 }, rewards: [] },
        { id: "b", name: "B", status: "upcoming", progress: { current: 0, max: 4 }, rewards: [] },
      ],
      banners: [],
    });
    expect(items.map((i) => [i.note, i.progress])).toEqual([
      ["Doppelt", 0.25],
      [undefined, undefined],
    ]);
  });

  const mode = { key: "abyss", label: "Spiral Abyss" } as ChallengeMode;
  const challenge = (c: Partial<Challenge>): Challenge => ({ state: "ok", facts: [], start: at(1), end: at(16), ...c });

  it("macht aus Herausforderungen Balken, außer gesperrt oder ohne Ende", () => {
    expect(fromChallenge("genshin", mode, challenge({ summary: "30/36 Sterne" }), now)).toMatchObject({
      status: "running",
      note: "30/36 Sterne",
    });
    expect(fromChallenge("genshin", mode, challenge({ state: "empty" }), now)?.note).toBe("Nicht gespielt");
    expect(fromChallenge("genshin", mode, challenge({ state: "locked" }), now)).toBeUndefined();
    expect(fromChallenge("genshin", mode, challenge({ end: undefined }), now)).toBeUndefined();
  });

  it("gilt bei vollem Fortschritt als erledigt", () => {
    const c = challenge({ progress: { current: 36, max: 36, unit: "Sterne" } });
    expect(fromChallenge("genshin", mode, c, now)).toMatchObject({ status: "done", progress: 1 });
  });
});
