import { describe, expect, it } from "vitest";
import { bannerOrder, groupBanners } from "./eventView";
import type { Banner } from "../../model/types";

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
