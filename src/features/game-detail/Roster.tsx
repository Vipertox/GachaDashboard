import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCharacterDetails, useRoster } from "../../app/hooks";
import { CHARACTER_ADAPTERS } from "../../api/characters";
import { ApiError, ERROR_TEXT } from "../../api/errors";
import { Card, GameIcon, Skeleton, fieldCls, fieldStyle } from "../../components/ui";
import { GAME_TERMS, RARITY_COLOR } from "../../model/games";
import type { CharacterSummary, GameAccountRef, GameStatus, GameTerms, Profile } from "../../model/types";
import { gearHints } from "./gearHints";
import { applyPrefs, loadPrefs, savePrefs, SORT_LABEL, type RosterPrefs, type SortKey } from "./rosterView";

/** Fehlertext für den Figuren-Tab; 10102 heißt hier, dass die Charakterdetails nicht öffentlich sind. */
export function characterErrorText(e: ApiError): string {
  return e.kind === "notes_disabled"
    ? "Charakterdetails in HoYoLAB unter Datenschutz freigeben"
    : `${ERROR_TEXT[e.kind]}: ${e.message}`;
}

export function ElementDot({ element, terms, size = 20 }: { element: string; terms: GameTerms; size?: number }) {
  const e = terms.elements[element];
  if (!e) return null;
  return (
    <span
      title={e.label}
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{ width: size, height: size, background: e.color, color: "#111", fontSize: size * 0.5 }}
    >
      {e.short ?? e.label.charAt(0)}
    </span>
  );
}

export function rarityBackground(rarity: number): string {
  const c = RARITY_COLOR[rarity] ?? "#5b6272";
  return `linear-gradient(160deg, ${c}, color-mix(in srgb, ${c} 45%, #000))`;
}

function Tile({
  c,
  terms,
  to,
  warn,
}: {
  c: CharacterSummary;
  terms: GameTerms;
  to: string;
  warn: boolean;
}) {
  const badge = "absolute rounded-md px-1.5 text-xs font-semibold bg-black/60 text-white";
  return (
    <Link to={to} className="block active:opacity-70">
      <div className="relative aspect-square rounded-xl overflow-hidden" style={{ background: rarityBackground(c.rarity) }}>
        {c.iconUrl ? (
          <img src={c.iconUrl} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-3xl font-bold text-white/70">
            {c.name.charAt(0)}
          </span>
        )}
        <span className="absolute top-1 left-1">
          <ElementDot element={c.element} terms={terms} />
        </span>
        <span className={`${badge} top-1 right-1`}>
          {terms.dupePrefix}
          {c.dupes}
        </span>
        <span className={`${badge} bottom-1 left-1`}>
          Lv {c.level}
          {warn && (
            <span className="ml-1" style={{ color: "var(--color-warn)" }} title="Ausrüstungslücke">
              ⚠
            </span>
          )}
        </span>
        {c.weapon && (
          <span className="absolute bottom-1 right-1 flex items-center rounded-md bg-black/60 text-white text-xs font-semibold pr-1">
            <GameIcon url={c.weapon.iconUrl} size={22} label={c.weapon.name} />
            {terms.refinePrefix}
            {c.weapon.refinement}
          </span>
        )}
      </div>
      <div className="mt-1 text-sm truncate text-center">{c.name}</div>
    </Link>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full px-3 text-sm min-h-9 shrink-0"
      style={{
        background: active ? "var(--text)" : "var(--surface-2)",
        color: active ? "var(--bg)" : "var(--text)",
      }}
    >
      {children}
    </button>
  );
}

export function Roster({ profile, gameRef, status }: { profile: Profile; gameRef: GameAccountRef; status?: GameStatus }) {
  const terms = GAME_TERMS[gameRef.game];
  const roster = useRoster(profile, gameRef);
  const details = useCharacterDetails(profile, gameRef, roster);
  const [prefs, setPrefs] = useState<RosterPrefs>(() => loadPrefs(gameRef.game));
  const update = (p: Partial<RosterPrefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    savePrefs(gameRef.game, next);
  };

  if (!CHARACTER_ADAPTERS[gameRef.game]) {
    return (
      <Card>
        <div className="p-4 space-y-1">
          <div className="text-2xl font-bold">
            {status?.characterCount ?? "–"} {terms.characters}
          </div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Die Schnittstelle des Launchers liefert nur die Anzahl. Waffen und {terms.gear} sind für dieses Spiel noch nicht
            verfügbar.
          </p>
        </div>
      </Card>
    );
  }

  if (!roster.data) {
    return roster.isError ? (
      <p style={{ color: "var(--color-danger)" }}>{characterErrorText(roster.error)}</p>
    ) : (
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    );
  }

  const all = roster.data.characters;
  const list = applyPrefs(all, prefs);
  const maxLevel = Math.max(0, ...all.map((c) => c.level));
  const elements = Object.keys(terms.elements).filter((e) => all.some((c) => c.element === e));
  const roles = Object.keys(terms.roles ?? {}).filter((r) => all.some((c) => c.role === r));
  const byId = details.data?.byId ?? {};

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm" style={{ color: "var(--muted)" }}>
        <span>
          {all.length} {terms.characters} · {all.filter((c) => c.level === maxLevel).length} auf Stufe {maxLevel}
        </span>
        <button className="min-h-9 px-2" onClick={() => void roster.refetch()} disabled={roster.isFetching}>
          {roster.isFetching || details.isFetching ? "Lädt …" : "↻ Neu laden"}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        <FilterChip active={!prefs.element} onClick={() => update({ element: "" })}>
          Alle
        </FilterChip>
        {elements.map((e) => (
          <FilterChip key={e} active={prefs.element === e} onClick={() => update({ element: prefs.element === e ? "" : e })}>
            <ElementDot element={e} terms={terms} size={16} />
            {terms.elements[e].label}
          </FilterChip>
        ))}
      </div>

      <div className="flex gap-2">
        {roles.length > 0 && (
          <select
            className={fieldCls}
            style={fieldStyle}
            value={prefs.role}
            onChange={(ev) => update({ role: ev.target.value })}
            aria-label={terms.roleLabel}
          >
            <option value="">{terms.roleLabel}: alle</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {terms.roles![r]}
              </option>
            ))}
          </select>
        )}
        <select
          className={fieldCls}
          style={fieldStyle}
          value={prefs.sort}
          onChange={(ev) => update({ sort: ev.target.value as SortKey })}
          aria-label="Sortierung"
        >
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              Sortiert nach {SORT_LABEL[k]}
            </option>
          ))}
        </select>
      </div>

      {details.isError && <p className="text-sm" style={{ color: "var(--color-warn)" }}>{characterErrorText(details.error)}</p>}
      {details.data?.error && (
        <p className="text-sm" style={{ color: "var(--color-warn)" }}>
          Nicht alle Details geladen: {characterErrorText(details.data.error)}
        </p>
      )}

      {list.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Keine {terms.characters} für diesen Filter.
        </p>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {list.map((c) => (
            <Tile
              key={c.id}
              c={c}
              terms={terms}
              to={`/game/${gameRef.game}/${gameRef.uid}/figur/${c.id}`}
              warn={!!byId[c.id] && gearHints(byId[c.id], terms).length > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
