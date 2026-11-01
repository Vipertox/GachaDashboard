import { z } from "zod";
import type { Banner, EventStatus } from "../../model/types";

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

/** HoYoLAB liefert Zeilenumbrüche in Beschreibungen teils als `\n`-Text. */
export const multiline = (s: string) => s.replace(/\\n/g, "\n").trim();

/** Seltenheit als Zahl oder Buchstabe (ZZZ: S, A, B). */
export const rarity = z.union([z.string(), z.number()]).optional().nullable();
const LETTER: Record<string, number> = { S: 5, A: 4, B: 3 };
export const toRarity = (r: string | number | null | undefined) =>
  typeof r === "number" ? r : (LETTER[String(r ?? "").toUpperCase()] ?? (Number(r) || 0));
