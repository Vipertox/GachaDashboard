import type { Banner, BannerKind, GameEvent } from "../../model/types";

export interface CurrencySummary {
  name: string;
  iconUrl?: string;
  total: number;
  remaining: number;
  /** Davon in Events, die noch nicht begonnen haben. */
  upcoming: number;
  /** Events mit offener Währung. */
  openEvents: number;
}

/** Summe der Premiumwährung über alle Events, getrennt nach Währung (pro Spiel ist es meist genau eine). */
export function currencySummary(events: GameEvent[]): CurrencySummary[] {
  const byName = new Map<string, CurrencySummary>();
  for (const e of events) {
    const c = e.currency;
    if (!c) continue;
    const s = byName.get(c.name) ?? { name: c.name, iconUrl: c.iconUrl, total: 0, remaining: 0, upcoming: 0, openEvents: 0 };
    s.iconUrl ??= c.iconUrl;
    s.total += c.total;
    s.remaining += c.remaining;
    if (e.status === "upcoming") s.upcoming += c.remaining;
    if (c.remaining > 0) s.openEvents += 1;
    byName.set(c.name, s);
  }
  return [...byName.values()];
}

/** Laufende und erledigte nach Ende, kommende nach Beginn; ohne Ende (dauerhaft) zuletzt. */
export function byTime(a: { start?: Date; end?: Date; status: string }, b: typeof a): number {
  const key = (x: typeof a) => (x.status === "upcoming" ? x.start : x.end)?.getTime() ?? Infinity;
  return key(a) - key(b);
}

const KIND_ORDER: Record<BannerKind, number> = { character: 0, weapon: 1, other: 2 };

const upcomingLast = (b: Banner) => (b.status === "upcoming" ? 1 : 0);

/** Erst laufende, dann kommende Banner; darin erst Charakter-, dann Waffen-, dann weitere, zuletzt nach Zeit. */
export function bannerOrder(a: Banner, b: Banner): number {
  return upcomingLast(a) - upcomingLast(b) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byTime(a, b);
}

export interface BannerGroup {
  key: string;
  /** Fehlt, wenn die API keine Version liefert. */
  version?: string;
  banners: Banner[];
  /** Enthält ein laufendes Banner; solche Gruppen sind anfangs aufgeklappt. */
  running: boolean;
}

/**
 * Banner nach Version gruppiert. Innerhalb einer Gruppe gilt `bannerOrder`; die Gruppen folgen ihrem
 * jeweils ersten Banner, damit die laufende Version vor der kommenden steht.
 */
export function groupBanners(banners: Banner[]): BannerGroup[] {
  const groups = new Map<string, Banner[]>();
  for (const b of banners) {
    const key = b.version ?? "";
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort(bannerOrder);
      return { key, version: key || undefined, banners: sorted, running: sorted.some((b) => b.status === "running") };
    })
    .sort((a, b) => bannerOrder(a.banners[0], b.banners[0]));
}
