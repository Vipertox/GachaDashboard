import { z } from "zod";
import { num, optNum } from "../adapters/util";
import type { Challenge, ChallengePeriod } from "../../model/types";

/** `schedule_type` der HoYoLAB-Endpunkte: 1 ist die laufende, 2 die vorherige Periode. */
export const scheduleType = (period: ChallengePeriod) => (period === "previous" ? 2 : 1);

/**
 * Feste UTC-Abweichung des Servers in Stunden. Star Rail und ZZZ liefern Zeiten als Datumsteile in Serverzeit,
 * die Server kennen keine Sommerzeit.
 */
export function serverOffset(region: string): number {
  if (/usa|_us$/.test(region)) return -5;
  if (/eur|_eu$/.test(region)) return 1;
  return 8;
}

export const partialTime = z
  .object({ year: num, month: num, day: num, hour: optNum, minute: optNum, second: optNum })
  .nullable()
  .optional();

export function serverDate(t: z.infer<typeof partialTime>, offsetHours: number): Date | undefined {
  if (!t?.year) return undefined;
  return new Date(Date.UTC(t.year, t.month - 1, t.day, (t.hour ?? 0) - offsetHours, t.minute ?? 0, t.second ?? 0));
}

/** Genshin liefert Unix-Sekunden, oft als Text. */
export function unixDate(v: number | undefined): Date | undefined {
  return v && v > 0 ? new Date(v * 1000) : undefined;
}

export const fmtNum = (n: number) => n.toLocaleString("de-DE");

/** ZZZ liefert Ranglistenplätze in Hundertstel Prozent, z. B. 123 für 1,23 %. */
export const fmtRank = (v: number) => `Top ${(v / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;

/**
 * Manche Namen enthalten Formatierungs-Tags wie `<unbreak>`. Entfernt wird bis nichts mehr übrig ist,
 * damit verschachtelte Reste wie `<scr<script>ipt>` keinen neuen Tag ergeben.
 */
export function plain(s: string | null | undefined): string {
  let out = s ?? "";
  let prev: string;
  do {
    prev = out;
    out = out.replace(/<[^<>]*>/g, "");
  } while (out !== prev);
  return out.replace(/[<>]/g, "").trim();
}

export function challenge(part: Partial<Challenge>): Challenge {
  const c: Challenge = { state: "ok", facts: [], ...part };
  if (!c.summary && c.progress) c.summary = `${c.progress.current}/${c.progress.max} ${c.progress.unit}`;
  return c;
}

/** Vorherige Periode aus einer Liste, die beide Perioden enthält (Imaginarium Theater, Stygian Onslaught). */
export function pickPeriod<T>(list: T[], period: ChallengePeriod): T | undefined {
  return list[period === "previous" ? 1 : 0];
}
