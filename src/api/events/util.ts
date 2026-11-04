import { z } from "zod";
import { optNum } from "../adapters/util";
import { optStr } from "../characters/util";
import type { Banner, EventCurrency, EventStatus } from "../../model/types";

/** Status aus Zeitraum und Erledigt-Kennzeichen; ohne Zeitraum gilt ein Event als laufend. */
export function eventStatus(start: Date | undefined, done: boolean, now: Date): EventStatus {
  if (start && start.getTime() > now.getTime()) return "upcoming";
  return done ? "done" : "running";
}

/** Abgelaufene Einträge liefern die Kalender teils noch mit, sie werden nicht angezeigt. */
export function isCurrent(e: { end?: Date }, now: Date): boolean {
  return !e.end || e.end.getTime() > now.getTime();
}

export function bannerStatus(start: Date | undefined, now: Date): Banner["status"] {
  return start && start.getTime() > now.getTime() ? "upcoming" : "running";
}

export const rewardSchema = z.object({ item_id: optNum, name: optStr, icon: optStr, num: optNum });

/**
 * Premiumwährung aus der Belohnungsliste, erkannt an der Item-ID und ersatzweise am Namen.
 * Die Liste nennt nur die Gesamtmenge; offen ist sie, solange das Event nicht erledigt ist.
 */
export function currencyFromRewards(
  rewards: z.infer<typeof rewardSchema>[] | null | undefined,
  match: { id: number; name: RegExp; label: string },
  done: boolean,
): EventCurrency | undefined {
  const hits = (rewards ?? []).filter((r) => r.item_id === match.id || (r.name && match.name.test(r.name)));
  const total = hits.reduce((sum, r) => sum + (r.num ?? 0), 0);
  if (!total) return undefined;
  return { name: match.label, total, remaining: done ? 0 : total, iconUrl: hits[0].icon ?? undefined };
}

/** HoYoLAB liefert Zeilenumbrüche in Beschreibungen teils als `\n`-Text. */
export const multiline = (s: string) => s.replace(/\\n/g, "\n").trim();

export { rarity, toRarity } from "../characters/util";
