import { describe, expect, it } from "vitest";
import { bannerOrder } from "./eventView";
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
});
