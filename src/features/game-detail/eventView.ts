import type { Banner, BannerKind } from "../../model/types";

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
