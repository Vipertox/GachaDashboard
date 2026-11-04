/** Übliche Länge einer Version in Tagen, für Schätzungen ohne Quelle. */
export const VERSION_DAYS = 42;

/** Kürzer läuft keine Version; ein früheres Ende stammt aus einer einzelnen Bannerphase. */
export const MIN_VERSION_DAYS = 28;

/** Alle Zeiten der Quellen ohne eigene Zeitzone gelten in UTC+8 (Asien-Server). */
export const SERVER_TZ = 8;

/**
 * Beginn der Update-Wartung in UTC+8, laut den offiziellen Ankündigungen:
 * Hoyoverse "Update Time Begins at 2026/09/28 06:00:00", Kuro "Maintenance Time: 2026-09-30 04:00 - 11:00 (UTC+8)".
 */
export const UPDATE_HOUR = { hoyoverse: 6, kuro: 4 } as const;

/**
 * Nächster Wartungsbeginn nach `d`. Die letzten Banner einer Version enden einige Stunden vor der Wartung
 * (ZZZ 14:59 Serverzeit, WuWa 11:59 Serverzeit am Vortag), die Wartung folgt zur festen Uhrzeit.
 */
export function nextUpdateAfter(d: Date, hour: number): Date {
  const local = new Date(d.getTime() + SERVER_TZ * 3_600_000);
  let t = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour) - SERVER_TZ * 3_600_000;
  if (t <= d.getTime()) t += 86_400_000;
  return new Date(t);
}

const VERSION_RE = /\b(?:Version|Ver\.?|V)\s?(\d+\.\d+)\b/gi;

/** Alle Versionsnummern in einem Text, z. B. aus "Version 4.7 Store Update" oder "V3.7 Battle Rush". */
export function versionsIn(text: string): string[] {
  return [...text.matchAll(VERSION_RE)].map((m) => m[1]);
}

export function firstVersion(text: string): string | undefined {
  return versionsIn(text)[0];
}

/** Vergleich nach Haupt- und Nebenversion: 3.10 kommt nach 3.9. */
export function compareVersion(a: string, b: string): number {
  const [a1, a2] = a.split(".").map(Number);
  const [b1, b2] = b.split(".").map(Number);
  return a1 - b1 || a2 - b2;
}

export function maxVersion(list: string[]): string | undefined {
  return list.reduce<string | undefined>((m, v) => (!m || compareVersion(v, m) > 0 ? v : m), undefined);
}

/** Naheliegende Folgeversion; nach x.8 kann auch eine neue Hauptversion kommen, daher nur geschätzt. */
export function guessNextVersion(v: string): string {
  const [major, minor] = v.split(".").map(Number);
  return `${major}.${minor + 1}`;
}

/** "2026-11-11 06:00:00" in der Zeitzone `tz` (Stunden gegenüber UTC). */
export function parseZoned(s: string | undefined, tz: number): Date | undefined {
  const m = s?.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return undefined;
  const [, y, mo, d, h = "0", mi = "0", sec = "0"] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - tz, +mi, +sec));
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/**
 * Datum aus dem Wiki: "2026-11-04", "2026-09-30 11:00" oder "October 21, 2026".
 * Ohne Uhrzeit gilt `defaultHour` in UTC+8.
 */
export function parseWikiDate(raw: string | undefined, defaultHour: number): Date | undefined {
  // Alles ab einem Kommentar zählt nicht, z. B. "<!--2026-10-01 03:59 ?-->".
  const s = raw?.split("<!--")[0].trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const hasTime = /\d{1,2}:\d{2}/.test(s);
    return parseZoned(hasTime ? s : `${s.slice(0, 10)} ${defaultHour}:00`, SERVER_TZ);
  }
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || month < 0) return undefined;
  return new Date(Date.UTC(+m[3], month, +m[2], defaultHour - SERVER_TZ));
}

/**
 * Nächstgelegener Wartungsbeginn zu `d`, höchstens 12 Stunden entfernt. getAnnList liefert die Zeiten mal in UTC+8,
 * mal um 7 Stunden verschoben (z. B. 00:00 statt 07:00), obwohl `timezone` immer 8 meldet.
 */
export function nearestUpdate(d: Date, hour: number): Date {
  return nextUpdateAfter(new Date(d.getTime() - 12 * 3_600_000), hour);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}
