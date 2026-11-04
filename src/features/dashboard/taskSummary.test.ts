import { describe, expect, it } from "vitest";
import { challengeDone, challengeSummary, eventSummary, weeklyResetAt, weeklySummary } from "./taskSummary";
import type { Challenge, DetailSection, GameEvent } from "../../model/types";

const section = (part: Partial<DetailSection>): DetailSection => ({
  kind: "weekly",
  resources: [],
  tasks: [],
  flags: [],
  timers: [],
  facts: [],
  ...part,
});

describe("Wöchentliche Aufgaben", () => {
  it("vereinheitlicht Flags, Tasks und Ressourcen und zählt die offenen", () => {
    const s = weeklySummary(
      section({
        flags: [{ label: "Wochenboss-Rabatte", done: false, text: "1 von 3 übrig" }],
        tasks: [{ label: "Bounty Commission", done: 4, total: 4 }],
        resources: [{ label: "Survey Points", current: 6000, max: 8000, iconKey: "zzz/survey" }],
      }),
    );
    expect(s.open).toBe(2);
    expect(s.items).toEqual([
      { label: "Wochenboss-Rabatte", done: false, text: "1 von 3 übrig" },
      { label: "Bounty Commission", done: true, text: "4/4", frac: 1, iconKey: undefined },
      { label: "Survey Points", done: false, text: "6.000/8.000", frac: 0.75, iconKey: "zzz/survey" },
    ]);
  });

  it("liefert nichts ohne Abschnitt", () => {
    expect(weeklySummary(undefined)).toEqual({ items: [], open: 0 });
  });
});

describe("Offene Events", () => {
  const now = Date.UTC(2026, 10, 4);
  const day = (n: number) => new Date(now + n * 86400_000);
  const ev = (id: string, status: GameEvent["status"], end?: number): GameEvent => ({
    id,
    name: id,
    status,
    end: end === undefined ? undefined : day(end),
    rewards: [],
  });

  it("zählt laufende, nicht erledigte Events, das zuerst endende vorn", () => {
    const s = eventSummary(
      [ev("spät", "running", 10), ev("ohne Ende", "running"), ev("bald", "running", 1), ev("fertig", "done", 5), ev("kommt", "upcoming", 20)],
      now,
    );
    expect(s.open.map((e) => e.id)).toEqual(["bald", "spät", "ohne Ende"]);
    expect(s.running).toBe(4);
    expect(s.endingSoon).toBe(1);
  });

  it("übergeht abgelaufene Events aus einem veralteten Stand", () => {
    expect(eventSummary([ev("vorbei", "running", -1)], now)).toEqual({ open: [], running: 0, endingSoon: 0 });
  });
});

describe("Herausforderungen", () => {
  const now = Date.UTC(2026, 10, 4);
  const end = new Date(now + 5 * 86400_000);
  const ch = (part: Partial<Challenge>): Challenge => ({ state: "ok", facts: [], end, ...part });

  it("wertet vollen Fortschritt und gespielte Modi ohne Maximum als erledigt", () => {
    expect(challengeDone(ch({ progress: { current: 36, max: 36, unit: "Sterne" } }))).toBe(true);
    expect(challengeDone(ch({ progress: { current: 30, max: 36, unit: "Sterne" } }))).toBe(false);
    expect(challengeDone(ch({ summary: "Stufe 5 · 98 s" }))).toBe(true);
    expect(challengeDone(ch({ state: "empty" }))).toBe(false);
  });

  it("zählt offene, ladende und fehlerhafte Modi, ohne gesperrte und abgelaufene", () => {
    const s = challengeSummary(
      [
        { data: ch({ progress: { current: 30, max: 36, unit: "Sterne" } }), isError: false },
        { data: ch({ state: "empty" }), isError: false },
        { data: ch({ progress: { current: 12, max: 12, unit: "Sterne" } }), isError: false },
        { data: ch({ state: "locked" }), isError: false },
        { data: ch({ state: "empty", end: new Date(now - 1000) }), isError: false },
        { isError: true },
        { isError: false },
      ],
      now,
    );
    expect(s).toEqual({ counted: 3, open: 2, loading: 1, failed: 1, endingSoon: 0 });
  });
});

describe("Bald endende Herausforderungen", () => {
  const now = Date.UTC(2026, 10, 4);
  const inDays = (n: number) => new Date(now + n * 86400_000);

  it("zählt nur offene Modi, die in weniger als drei Tagen enden", () => {
    const s = challengeSummary(
      [
        { data: { state: "empty", facts: [], end: inDays(1) }, isError: false },
        { data: { state: "ok", facts: [], end: inDays(1), progress: { current: 7, max: 9, unit: "Sterne" } }, isError: false },
        { data: { state: "ok", facts: [], end: inDays(1), progress: { current: 9, max: 9, unit: "Sterne" } }, isError: false },
        { data: { state: "ok", facts: [], end: inDays(1), summary: "196.095 Punkte" }, isError: false },
        { data: { state: "empty", facts: [], end: inDays(4) }, isError: false },
      ],
      now,
    );
    expect(s.endingSoon).toBe(2);
    expect(s.open).toBe(3);
  });
});

describe("Wochenreset", () => {
  // Mittwoch, 04.11.2026, 00:00 UTC
  const wed = Date.UTC(2026, 10, 4);

  it("liegt montags um 04:00 Serverzeit", () => {
    expect(weeklyResetAt("genshin", "os_euro", wed).toISOString()).toBe("2026-11-09T03:00:00.000Z");
    expect(weeklyResetAt("starrail", "prod_official_usa", wed).toISOString()).toBe("2026-11-09T09:00:00.000Z");
    expect(weeklyResetAt("zzz", "prod_gf_jp", wed).toISOString()).toBe("2026-11-08T20:00:00.000Z");
    expect(weeklyResetAt("wuwa", "Europe", wed).toISOString()).toBe("2026-11-09T03:00:00.000Z");
  });

  it("springt genau zum Reset auf die nächste Woche", () => {
    const reset = Date.UTC(2026, 10, 9, 3);
    expect(weeklyResetAt("genshin", "os_euro", reset - 60_000).getTime()).toBe(reset);
    expect(weeklyResetAt("genshin", "os_euro", reset).getTime()).toBe(reset + 7 * 86400_000);
  });
});
