import { z } from "zod";
import { ApiError } from "../errors";
import { secondsFromNow } from "../../lib/time";
import type { Countdown, DetailSection, Resource } from "../../model/types";

/** Zahl oder Zahl-String, sonst Fehler. */
export const num = z.coerce.number();
export const optNum = z.coerce.number().optional();

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
  return { kind, resources: [], tasks: [], flags: [], timers: [], ...part };
}

export function nonEmpty(s: DetailSection): boolean {
  return s.resources.length + s.tasks.length + s.flags.length + s.timers.length > 0;
}

export function timer(label: string, seconds: number, now: Date, iconUrl?: string): Countdown {
  return { label, readyAt: secondsFromNow(seconds, now), iconUrl };
}
