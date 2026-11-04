import { z } from "zod";
import { ApiError } from "../errors";
import { secondsFromNow } from "../../lib/time";
import type { Countdown, DetailSection, Resource } from "../../model/types";

const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/;

/**
 * Zahl oder Zahl-String, sonst Schemafehler. Bewusst ohne `z.coerce`: das machte
 * aus `null` und `""` still eine 0 und verdeckte geänderte Schnittstellen.
 */
export const num = z.union([z.number(), z.string().trim().regex(NUMERIC_TEXT)]).transform(Number);
/** Wie `num`; fehlend, `null` und `""` ergeben `undefined`. */
export const optNum = z
  .union([z.literal("").transform(() => undefined), num])
  .nullish()
  .transform((v) => v ?? undefined)
  // hält den Schlüssel im abgeleiteten Typ optional (`a?: number`)
  .optional();

export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const res = schema.safeParse(data);
  if (!res.success) {
    throw new ApiError("schema", `Schnittstelle geändert: ${res.error.issues[0]?.path.join(".")}`);
  }
  return res.data;
}

interface ResourceInput {
  label: string;
  iconKey: string;
  current: number;
  max: number;
  /** Restzeit bis voll in Sekunden (HoYoLAB). */
  recoverSeconds?: number;
  /** Zeitpunkt bis voll (Kuro, Unix-ms). 0 oder fehlend = voll. */
  fullAtMs?: number;
  /** Sekunden pro Punkt, falls bekannt; sonst aus Restzeit und fehlenden Punkten abgeleitet. */
  regenSeconds?: number;
  now: Date;
}

export function makeResource(i: ResourceInput): Resource {
  const missing = Math.max(0, i.max - i.current);
  let fullAt: Date | undefined;
  if (missing > 0) {
    if (i.fullAtMs && i.fullAtMs > 0) fullAt = new Date(i.fullAtMs);
    else if (i.recoverSeconds && i.recoverSeconds > 0) fullAt = secondsFromNow(i.recoverSeconds, i.now);
  }
  let regenSeconds = i.regenSeconds;
  if (!regenSeconds && fullAt && missing > 0) {
    regenSeconds = (fullAt.getTime() - i.now.getTime()) / 1000 / missing;
  }
  return {
    label: i.label,
    iconKey: i.iconKey,
    current: i.current,
    max: i.max,
    fullAt,
    regenSeconds,
  };
}

export function section(kind: DetailSection["kind"], part: Partial<DetailSection>): DetailSection {
  return { kind, resources: [], tasks: [], flags: [], timers: [], facts: [], ...part };
}

/**
 * Battle Pass für den Abschnitt Wöchentlich. Unter der Höchststufe zählt die Wochen-EXP als Balken;
 * auf der Höchststufe gibt es nichts mehr zu holen, dann steht er als erledigtes Flag da.
 */
export function battlePass(bp: {
  label: string;
  iconKey: string;
  level: number;
  maxLevel: number;
  weekExp?: number;
  weekMaxExp?: number;
  now: Date;
}): Pick<DetailSection, "resources" | "flags"> {
  if (bp.level >= bp.maxLevel) {
    return { resources: [], flags: [{ label: bp.label, done: true, text: `Höchststufe ${bp.maxLevel}` }] };
  }
  if (!bp.weekMaxExp) return { resources: [], flags: [] };
  return {
    resources: [
      makeResource({
        label: `${bp.label} (Stufe ${bp.level})`,
        iconKey: bp.iconKey,
        current: bp.weekExp ?? 0,
        max: bp.weekMaxExp,
        now: bp.now,
      }),
    ],
    flags: [],
  };
}

export function nonEmpty(s: DetailSection): boolean {
  return s.resources.length + s.tasks.length + s.flags.length + s.timers.length + s.facts.length > 0;
}

export function timer(label: string, seconds: number, now: Date, iconUrl?: string): Countdown {
  return { label, readyAt: secondsFromNow(seconds, now), iconUrl };
}
