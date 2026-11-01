import type { CharacterSummary, GameId } from "../../model/types";

export type SortKey = "level" | "rarity" | "dupes" | "name";

export const SORT_LABEL: Record<SortKey, string> = {
  level: "Stufe",
  rarity: "Seltenheit",
  dupes: "Duplikate",
  name: "Name",
};

export interface RosterPrefs {
  sort: SortKey;
  element: string;
  role: string;
}

const DEFAULT: RosterPrefs = { sort: "level", element: "", role: "" };

/** Reine Anzeige-Einstellung pro Spiel; fehlt der Speicher, gelten die Standardwerte. */
export function loadPrefs(game: GameId): RosterPrefs {
  try {
    const raw = localStorage.getItem(`roster:${game}`);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<RosterPrefs>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function savePrefs(game: GameId, prefs: RosterPrefs): void {
  try {
    localStorage.setItem(`roster:${game}`, JSON.stringify(prefs));
  } catch {
    // Privater Modus o. Ä.: Einstellung gilt nur bis zum Neuladen.
  }
}

/** Gefilterte und sortierte Liste; das Figur-Detail blättert in derselben Reihenfolge. */
export function applyPrefs(list: CharacterSummary[], p: RosterPrefs): CharacterSummary[] {
  const byName = (a: CharacterSummary, b: CharacterSummary) => a.name.localeCompare(b.name, "de");
  const cmp: Record<SortKey, (a: CharacterSummary, b: CharacterSummary) => number> = {
    level: (a, b) => b.level - a.level || b.rarity - a.rarity || byName(a, b),
    rarity: (a, b) => b.rarity - a.rarity || b.level - a.level || byName(a, b),
    dupes: (a, b) => b.dupes - a.dupes || b.rarity - a.rarity || byName(a, b),
    name: byName,
  };
  return list
    .filter((c) => (!p.element || c.element === p.element) && (!p.role || c.role === p.role))
    .sort(cmp[p.sort]);
}
