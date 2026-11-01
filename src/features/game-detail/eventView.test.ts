import { describe, expect, it } from "vitest";
import { bannerOrder, currencySummary, groupBanners } from "./eventView";
import type { Banner, GameEvent } from "../../model/types";

describe("Währung", () => {
  const ev = (status: GameEvent["status"], total: number, remaining: number): GameEvent => ({
    id: `${status}-${total}`,
    name: "Event",
    status,
    rewards: [],
    currency: { name: "Primogems", total, remaining },
  });

  it("summiert offene, kommende und gesamte Währung", () => {
    const [s] = currencySummary([
      ev("running", 420, 420),
      ev("done", 300, 0),
      ev("upcoming", 900, 900),
      { id: "x", name: "Ohne", status: "running", rewards: [] },
    ]);
    expect(s).toEqual({ name: "Primogems", iconUrl: undefined, total: 1620, remaining: 1320, upcoming: 900, openEvents: 2 });
  });

  it("liefert nichts ohne Währung", () => {
    expect(currencySummary([{ id: "x", name: "Ohne", status: "running", rewards: [] }])).toEqual([]);
  });
});

const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n));
const banner = (id: string, kind: Banner["kind"], status: Banner["status"], start: number, end: number): Banner => ({
  id,
  name: id,
  kind,
  status,
  start: day(start),
  end: day(end),
  items: [],
});

describe("Banner-Reihenfolge", () => {
  it("zeigt erst laufende, dann kommende Banner, darin nach Art und Zeit", () => {
    const list = [
      banner("waffe-bald", "weapon", "upcoming", 3, 20),
      banner("weitere", "other", "running", -5, 4),
      banner("charakter-bald", "character", "upcoming", 5, 20),
      banner("waffe", "weapon", "running", -5, 10),
      banner("charakter-spät", "character", "running", -5, 12),
      banner("charakter-früh", "character", "running", -5, 8),
    ];
    expect([...list].sort(bannerOrder).map((b) => b.id)).toEqual([
      "charakter-früh",
      "charakter-spät",
      "waffe",
      "weitere",
      "charakter-bald",
      "waffe-bald",
    ]);
  });

  it("gruppiert nach Version, laufende Version zuerst", () => {
    const v = (b: Banner, version?: string): Banner => ({ ...b, version });
    const groups = groupBanners([
      v(banner("neu-waffe", "weapon", "upcoming", 3, 20), "3.8"),
      v(banner("waffe", "weapon", "running", -5, 10), "3.7"),
      v(banner("neu-charakter", "character", "upcoming", 3, 20), "3.8"),
      v(banner("charakter", "character", "running", -5, 10), "3.7"),
      banner("ohne", "other", "upcoming", 30, 40),
    ]);
    expect(groups.map((g) => [g.version, g.running, g.banners.map((b) => b.id)])).toEqual([
      ["3.7", true, ["charakter", "waffe"]],
      ["3.8", false, ["neu-charakter", "neu-waffe"]],
      [undefined, false, ["ohne"]],
    ]);
  });
});
