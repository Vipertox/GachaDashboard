import type { Character, GameTerms } from "../../model/types";

/**
 * Lücken in der Ausrüstung nach eindeutigen Regeln, ohne Build-Empfehlung.
 * Ein Set mit einem Teil gilt nicht als Lücke, weil 4+1-Kombinationen üblich sind.
 */
export function gearHints(c: Character, terms: GameTerms): string[] {
  const hints: string[] = [];

  const used = new Set(c.gear.map((g) => g.slot));
  const empty = terms.slots.filter((_, i) => !used.has(i + 1));
  if (empty.length) hints.push(`Platz leer: ${empty.join(", ")}`);

  for (const s of c.sets) {
    if (s.bonuses.some((b) => b.pieces === s.count + 1) && s.count > 1) {
      hints.push(`Set unvollständig: ${s.name} (${s.count}/${s.count + 1})`);
    }
  }

  const low = c.gear.filter((g) => g.level < g.maxLevel);
  if (low.length) hints.push(`${low.length} ${low.length === 1 ? "Teil" : "Teile"} nicht ausgebaut`);

  if (c.weapon && c.weapon.level < c.level) {
    hints.push(`${terms.weapon} unter Figurenstufe (${c.weapon.level}/${c.level})`);
  } else if (!c.weapon) {
    hints.push(`Keine ${terms.weapon} angelegt`);
  }

  return hints;
}
