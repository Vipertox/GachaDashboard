import { describe, expect, it } from "vitest";
import { countdownParts, sortByCountdown } from "./countdownView";

describe("countdownView", () => {
  it("zerlegt die Restzeit in Tage bis Sekunden", () => {
    const ms = ((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000;
    expect(countdownParts(ms)?.map((p) => p.value)).toEqual([2, 3, 4, 5]);
    expect(countdownParts(0)).toBeUndefined();
  });

  it("sortiert nach kürzestem Countdown, ohne Ende ans Ende, sonst stabil", () => {
    const row = (game: string, end?: string) => ({ game, info: end ? { end: new Date(end) } : undefined });
    const rows = [row("genshin", "2026-12-15T22:00:00Z"), row("zzz"), row("starrail", "2026-11-10T22:00:00Z"), row("wuwa", "2026-11-10T22:00:00Z")];
    expect(sortByCountdown(rows).map((r) => r.game)).toEqual(["starrail", "wuwa", "genshin", "zzz"]);
    expect(rows.map((r) => r.game)).toEqual(["genshin", "zzz", "starrail", "wuwa"]);
  });
});
