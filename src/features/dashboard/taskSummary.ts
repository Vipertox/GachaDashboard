import type { Challenge, DetailSection, GameEvent } from "../../model/types";

/** Eine wöchentliche Aufgabe, vereinheitlicht aus Flags, Tasks und Ressourcen des Abschnitts. */
export interface WeeklyItem {
  label: string;
  done: boolean;
  /** Stand als Text, z. B. "1 von 3 übrig" oder "6000/8000". */
  text?: string;
  /** Anteil für den Fortschrittsbalken, fehlt bei reinen Ja/Nein-Aufgaben. */
  frac?: number;
  iconKey?: string;
}

export interface WeeklySummary {
  items: WeeklyItem[];
  open: number;
}

/** Wöchentliche Aufgaben eines Spiels; offen ist, was noch nicht erledigt oder voll ist. */
export function weeklySummary(section: DetailSection | undefined): WeeklySummary {
  if (!section) return { items: [], open: 0 };
  const items: WeeklyItem[] = [
    ...section.flags.map((f) => ({ label: f.label, done: f.done, text: f.text })),
    ...section.tasks.map((t) => ({
      label: t.label,
      done: t.done >= t.total,
      text: `${t.done}/${t.total}`,
      frac: t.total > 0 ? Math.min(1, t.done / t.total) : 0,
      iconKey: t.iconKey,
    })),
    ...section.resources.map((r) => ({
      label: r.label,
      done: r.current >= r.max,
      text: `${r.current.toLocaleString("de-DE")}/${r.max.toLocaleString("de-DE")}`,
      frac: r.max > 0 ? Math.min(1, r.current / r.max) : 0,
      iconKey: r.iconKey,
    })),
  ];
  return { items, open: items.filter((i) => !i.done).length };
}

export interface EventSummary {
  /** Laufende, noch nicht erledigte Events, das zuerst endende vorn. */
  open: GameEvent[];
  /** Laufende Events insgesamt, erledigte eingeschlossen. */
  running: number;
}

/**
 * Offene Events: begonnen, nicht erledigt und noch nicht abgelaufen. Kommende zählen nicht,
 * dort lässt sich noch nichts tun; ein Ende in der Vergangenheit kommt aus einem veralteten Cache.
 */
export function eventSummary(events: GameEvent[], now: number): EventSummary {
  const active = events.filter((e) => e.status !== "upcoming" && (!e.end || e.end.getTime() > now));
  const open = active
    .filter((e) => e.status === "running")
    .sort((a, b) => (a.end?.getTime() ?? Infinity) - (b.end?.getTime() ?? Infinity));
  return { open, running: active.length };
}

/**
 * Erledigt ist ein gespielter Modus mit vollem Fortschritt. Modi ohne Maximum (nur Bestwert,
 * z. B. Stygian Onslaught oder Deadly Assault) gelten als erledigt, sobald sie gespielt sind.
 */
export function challengeDone(c: Challenge): boolean {
  return c.state === "ok" && (!c.progress || c.progress.current >= c.progress.max);
}

/** Zählt der Modus mit? Gesperrte Modi und laut Cache schon abgelaufene Perioden nicht. */
export function challengeCounts(c: Challenge, now: number): boolean {
  return c.state !== "locked" && (!c.end || c.end.getTime() > now);
}

export interface ChallengeSummary {
  /** Mitgezählte Modi mit Daten. */
  counted: number;
  open: number;
  loading: number;
  failed: number;
}

/** Stand der laufenden Periode über alle Modi eines Spiels; jeder Eintrag ist das Ergebnis einer Abfrage. */
export function challengeSummary(results: { data?: Challenge; isError: boolean }[], now: number): ChallengeSummary {
  const s: ChallengeSummary = { counted: 0, open: 0, loading: 0, failed: 0 };
  for (const r of results) {
    if (r.data) {
      if (!challengeCounts(r.data, now)) continue;
      s.counted += 1;
      if (!challengeDone(r.data)) s.open += 1;
    } else if (r.isError) s.failed += 1;
    else s.loading += 1;
  }
  return s;
}
