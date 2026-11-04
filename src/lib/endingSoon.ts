import type { Challenge, GameEvent } from "../model/types";

/** Ab drei Tagen vor Ende wird Offenes hervorgehoben: auf der Detailseite und in den Chips des Dashboards. */
export const ENDING_SOON_MS = 3 * 86400_000;

/** Endet in weniger als `ENDING_SOON_MS`, aber noch nicht vorbei. */
export function endsSoon(end: Date | undefined, now: number): boolean {
  if (!end) return false;
  const left = end.getTime() - now;
  return left > 0 && left < ENDING_SOON_MS;
}

/** Laufendes, nicht erledigtes Event, das bald endet. */
export function eventEndingSoon(e: GameEvent, now: number): boolean {
  return e.status === "running" && endsSoon(e.end, now);
}

/** Läuft noch, endet bald und ist nicht vollständig. */
export function challengeEndingSoon(c: Challenge, now: number): boolean {
  if (c.state === "locked") return false;
  const open = c.state === "empty" || (!!c.progress && c.progress.current < c.progress.max);
  return open && endsSoon(c.end, now);
}
