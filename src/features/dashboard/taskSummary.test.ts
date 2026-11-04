import { describe, expect, it } from "vitest";
import { eventSummary, weeklySummary } from "./taskSummary";
import type { DetailSection, GameEvent } from "../../model/types";

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
  });

  it("übergeht abgelaufene Events aus einem veralteten Stand", () => {
    expect(eventSummary([ev("vorbei", "running", -1)], now)).toEqual({ open: [], running: 0 });
  });
});
