export interface CountdownPart {
  value: number;
  label: string;
}

/** Restzeit zerlegt in Tage, Stunden, Minuten, Sekunden; abgelaufen ergibt `undefined`. */
export function countdownParts(ms: number): CountdownPart[] | undefined {
  if (ms <= 0) return undefined;
  const s = Math.floor(ms / 1000);
  return [
    { value: Math.floor(s / 86400), label: "Tage" },
    { value: Math.floor((s % 86400) / 3600), label: "Std" },
    { value: Math.floor((s % 3600) / 60), label: "Min" },
    { value: s % 60, label: "Sek" },
  ];
}

const SORT_KEY = "countdown:sortByTime";

/** Reine Anzeige-Einstellung; ohne Speicher gilt die Reihenfolge des Dashboards. */
export function loadSortByTime(): boolean {
  try {
    return localStorage.getItem(SORT_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSortByTime(on: boolean): void {
  try {
    localStorage.setItem(SORT_KEY, on ? "1" : "0");
  } catch {
    // Privater Modus o. Ä.: Einstellung gilt nur bis zum Neuladen.
  }
}

/**
 * Kürzester Countdown zuerst. Laufende Updates (Ende erreicht) stehen ganz oben, noch ladende oder fehlerhafte
 * Spiele ohne Ende am Schluss; bei Gleichstand bleibt die Reihenfolge des Dashboards.
 */
export function sortByCountdown<T extends { info?: { end: Date } }>(rows: T[]): T[] {
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.info?.end.getTime() ?? Infinity) - (b.r.info?.end.getTime() ?? Infinity) || a.i - b.i)
    .map((x) => x.r);
}
