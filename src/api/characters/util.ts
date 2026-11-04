import { z } from "zod";
import type { GearPiece, GearSet, Stat } from "../../model/types";

/**
 * Text oder Zahl (IDs kommen je nach Endpunkt als beides), sonst Schemafehler.
 * Bewusst ohne `z.coerce`: das machte aus fehlenden Feldern den Text "undefined".
 */
export const str = z.union([z.string(), z.number()]).transform(String);
export const optStr = str.optional().nullable();

/** HoYoLAB liefert Werte als Text mit Dezimalpunkt ("46.6%"); angezeigt wird mit Komma. */
export function fmtValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "–";
  return String(v).replace(/(\d)\.(\d)/g, "$1,$2");
}

/** Namen der Werte kommen bei HoYoLAB getrennt in `property_map` bzw. `property_info`. */
export type PropertyNames = Record<string, string>;

export function propertyNames(map: Record<string, { name?: string | null } | undefined> | null | undefined): PropertyNames {
  const out: PropertyNames = {};
  for (const [k, v] of Object.entries(map ?? {})) if (v?.name) out[k] = v.name;
  return out;
}

export function stat(
  names: PropertyNames,
  type: string | number | null | undefined,
  value: string | number | null | undefined,
  rolls?: number | null,
): Stat {
  const key = String(type ?? "");
  return {
    key,
    // Unbekannte Werte erscheinen mit roher ID statt die Anzeige abzubrechen.
    label: names[key] ?? `Wert ${key}`,
    value: fmtValue(value),
    rolls: rolls && rolls > 0 ? rolls : undefined,
  };
}

/** Fasst die Teile nach Set zusammen; `bonuses` liefert die Bonusstufen je Set. */
export function groupSets(
  gear: GearPiece[],
  bonuses: (setName: string) => { pieces: number; text?: string }[],
): GearSet[] {
  const counts = new Map<string, number>();
  for (const g of gear) if (g.setName) counts.set(g.setName, (counts.get(g.setName) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, bonuses: bonuses(name) }))
    .sort((a, b) => b.count - a.count);
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Wichtigste Werte nach der Reihenfolge in `order`, der Rest in Originalreihenfolge. */
export function splitStats(stats: Stat[], order: string[]): { stats: Stat[]; moreStats: Stat[] } {
  const main = order.map((k) => stats.find((s) => s.key === k)).filter((s): s is Stat => !!s);
  return { stats: main, moreStats: stats.filter((s) => !main.includes(s)) };
}

/** Seltenheit als Zahl, Zahl-Text oder Buchstabe (ZZZ: S, A, B). */
export const rarity = z.union([z.string(), z.number()]).optional().nullable();
const RARITY_LETTER: Record<string, number> = { S: 5, A: 4, B: 3 };
export const toRarity = (r: string | number | null | undefined) =>
  typeof r === "number" ? r : (RARITY_LETTER[String(r ?? "").toUpperCase()] ?? (Number(r) || 0));
