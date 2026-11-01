import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../app/state";
import { useCharacter, useRoster } from "../../app/hooks";
import { Card, GameIcon, Skeleton } from "../../components/ui";
import { GAME_ACCENT, GAME_TERMS } from "../../model/games";
import type { Character, GameAccountRef, GameId, GameTerms, GearPiece, Profile, Stat } from "../../model/types";
import { openExternal } from "../../lib/native";
import { gearHints } from "./gearHints";
import { prydwenUrl } from "./prydwen";
import { characterErrorText, ElementDot, rarityBackground } from "./Roster";
import { applyPrefs, loadPrefs } from "./rosterView";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {title}
      </h2>
      <Card>
        <div className="p-4">{children}</div>
      </Card>
    </section>
  );
}

function StatChip({ s }: { s: Stat }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 min-h-7 text-xs" style={{ background: "var(--surface-2)" }}>
      {s.label} <span className="font-semibold">{s.value}</span>
      {s.rolls ? (
        <span aria-label={`${s.rolls} Erhöhungen`} style={{ color: "var(--color-ok)" }}>
          {"•".repeat(s.rolls)}
        </span>
      ) : null}
    </span>
  );
}

function Stars({ n }: { n: number }) {
  return <span style={{ color: "#e8b04a" }}>{"★".repeat(Math.max(0, n))}</span>;
}

function GearRow({ slotLabel, g }: { slotLabel: string; g?: GearPiece }) {
  if (!g) {
    return (
      <li className="flex items-center gap-3 py-2">
        <span className="w-11 h-11 rounded-xl border-2 border-dashed shrink-0" style={{ borderColor: "var(--border)" }} />
        <span style={{ color: "var(--muted)" }}>{slotLabel}: leer</span>
      </li>
    );
  }
  const low = g.level < g.maxLevel;
  return (
    <li className="flex gap-3 py-2">
      <span className="rounded-xl shrink-0 self-start" style={{ background: rarityBackground(g.rarity) }}>
        <GameIcon url={g.iconUrl} size={44} label={slotLabel} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm truncate">
            <span style={{ color: "var(--muted)" }}>{slotLabel} · </span>
            {g.setName ?? g.name}
          </span>
          <span className="text-xs font-semibold shrink-0" style={{ color: low ? "var(--color-warn)" : "var(--muted)" }}>
            +{g.level}
          </span>
        </div>
        {g.mainStat && (
          <div className="font-semibold">
            {g.mainStat.label} {g.mainStat.value}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {g.subStats.map((s, i) => (
            <StatChip key={`${s.key}-${i}`} s={s} />
          ))}
        </div>
      </div>
    </li>
  );
}

function StatList({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {stats.map((s, i) => (
        <div key={`${s.key}-${i}`} className="flex justify-between gap-2">
          <dt className="truncate" style={{ color: "var(--muted)" }}>
            {s.label}
          </dt>
          <dd className="font-semibold">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PrydwenLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        void openExternal(url);
      }}
      className="flex items-center justify-between gap-3 rounded-xl px-4 min-h-12 text-sm"
      style={{ background: "var(--surface-2)" }}
    >
      <span>
        <span className="font-semibold">Build-Guide auf Prydwen</span>
        <span className="block text-xs" style={{ color: "var(--muted)" }}>
          Builds im Tab „Build and teams“
        </span>
      </span>
      <span aria-hidden="true" className="text-indigo-400">
        ↗
      </span>
    </a>
  );
}

function Detail({ c, game, terms, accent }: { c: Character; game: GameId; terms: GameTerms; accent: string }) {
  const [allStats, setAllStats] = useState(false);
  const [openSet, setOpenSet] = useState<string>();
  const hints = gearHints(c, terms);
  const guideUrl = prydwenUrl(game, c);
  const w = c.weapon;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl overflow-hidden flex items-end gap-4 p-4 min-h-40" style={{ background: rarityBackground(c.rarity) }}>
        <GameIcon url={c.imageUrl ?? c.iconUrl} size={112} label={c.name} />
        <div className="min-w-0 text-white space-y-1">
          <div className="flex items-center gap-2">
            <ElementDot element={c.element} terms={terms} />
            <span className="text-sm opacity-80">
              {terms.elements[c.element]?.label}
              {c.role && terms.roles?.[c.role] ? ` · ${terms.roles[c.role]}` : ""}
            </span>
          </div>
          <h1 className="text-2xl font-bold truncate">{c.name}</h1>
          <div className="text-sm">
            <Stars n={c.rarity} /> · Stufe {c.level}
          </div>
          <div className="flex items-center gap-1" aria-label={`${terms.dupePrefix}${c.dupes}`}>
            <span className="text-xs mr-1">
              {terms.dupePrefix}
              {c.dupes}
            </span>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: i < c.dupes ? "#fff" : "rgba(255,255,255,0.25)" }} />
            ))}
          </div>
        </div>
      </div>

      {hints.length > 0 && (
        <ul className="rounded-xl p-3 text-sm space-y-1" style={{ background: "color-mix(in srgb, var(--color-warn) 15%, transparent)" }}>
          {hints.map((h) => (
            <li key={h}>⚠ {h}</li>
          ))}
        </ul>
      )}

      {guideUrl && <PrydwenLink url={guideUrl} />}

      <Block title={terms.weapon}>
        {w ? (
          <div className="flex gap-3">
            <span className="rounded-xl shrink-0 self-start" style={{ background: rarityBackground(w.rarity) }}>
              <GameIcon url={w.iconUrl} size={56} label={w.name} />
            </span>
            <div className="min-w-0 space-y-1">
              <div className="font-semibold">{w.name}</div>
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                <Stars n={w.rarity} /> · Stufe {w.level} · {terms.refinePrefix}
                {w.refinement}
              </div>
              <div className="flex flex-wrap gap-1">
                {w.mainStat && <StatChip s={w.mainStat} />}
                {w.subStat && <StatChip s={w.subStat} />}
              </div>
            </div>
          </div>
        ) : (
          <span style={{ color: "var(--muted)" }}>Keine {terms.weapon} angelegt</span>
        )}
      </Block>

      <Block title={terms.gear}>
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {terms.slots.map((label, i) => (
            <GearRow key={label} slotLabel={label} g={c.gear.find((g) => g.slot === i + 1)} />
          ))}
        </ul>
        {c.sets.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {c.sets.map((s) => {
                const active = s.bonuses.some((b) => b.pieces <= s.count);
                return (
                  <button
                    key={s.name}
                    onClick={() => setOpenSet(openSet === s.name ? undefined : s.name)}
                    className="rounded-full px-3 min-h-8 text-sm"
                    style={{
                      background: active ? `color-mix(in srgb, ${accent} 25%, transparent)` : "var(--surface-2)",
                      color: active ? "var(--text)" : "var(--muted)",
                    }}
                  >
                    {s.name} ×{s.count}
                  </button>
                );
              })}
            </div>
            {openSet && (
              <ul className="text-sm space-y-1">
                {c.sets
                  .find((s) => s.name === openSet)
                  ?.bonuses.filter((b) => b.text)
                  .map((b) => (
                    <li key={b.pieces}>
                      <span className="font-semibold">{b.pieces} Teile:</span> {b.text}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </Block>

      {c.skills.length > 0 && (
        <Block title={terms.skills}>
          <div className="grid grid-cols-3 gap-3 text-center">
            {c.skills.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold">{s.level}</div>
                <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}

      {c.stats.length + c.moreStats.length > 0 && (
        <Block title="Werte">
          <StatList stats={allStats ? [...c.stats, ...c.moreStats] : c.stats.length ? c.stats : c.moreStats.slice(0, 6)} />
          {c.moreStats.length > 0 && (
            <button className="mt-2 min-h-9 text-sm text-indigo-400" onClick={() => setAllStats(!allStats)}>
              {allStats ? "Weniger Werte" : "Alle Werte"}
            </button>
          )}
        </Block>
      )}

      {c.companion && (
        <Block title="Memosprite">
          <div className="flex items-center gap-3">
            <GameIcon url={c.companion.iconUrl} size={44} round label={c.companion.name} />
            <span>{c.companion.name}</span>
          </div>
        </Block>
      )}
    </div>
  );
}

function Body({ profile, gameRef, id }: { profile: Profile; gameRef: GameAccountRef; id: string }) {
  const navigate = useNavigate();
  const terms = GAME_TERMS[gameRef.game];
  const roster = useRoster(profile, gameRef);
  const touchX = useRef<number | undefined>(undefined);

  const order = applyPrefs(roster.data?.characters ?? [], loadPrefs(gameRef.game));
  const idx = order.findIndex((c) => c.id === id);
  const go = (delta: number) => {
    const next = order[idx + delta];
    if (next) navigate(`/game/${gameRef.game}/${gameRef.uid}/figur/${next.id}`, { replace: true });
  };

  const { character: c, error: detailError, loaded } = useCharacter(profile, gameRef, roster.data, id);
  const error = roster.error ?? detailError;
  return (
    <div
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === undefined) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = undefined;
        if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
      }}
      className="space-y-4"
    >
      {idx >= 0 && (
        <div className="flex items-center justify-between text-sm" style={{ color: "var(--muted)" }}>
          <button className="min-h-11 min-w-11 disabled:opacity-30" disabled={idx === 0} onClick={() => go(-1)} aria-label="Vorherige Figur">
            ‹ {order[idx - 1]?.name ?? ""}
          </button>
          <span>
            {idx + 1} / {order.length}
          </span>
          <button
            className="min-h-11 min-w-11 disabled:opacity-30"
            disabled={idx === order.length - 1}
            onClick={() => go(1)}
            aria-label="Nächste Figur"
          >
            {order[idx + 1]?.name ?? ""} ›
          </button>
        </div>
      )}
      {c ? (
        <Detail key={c.id} c={c} game={gameRef.game} terms={terms} accent={GAME_ACCENT[gameRef.game]} />
      ) : error ? (
        <p style={{ color: "var(--color-danger)" }}>{characterErrorText(error)}</p>
      ) : loaded ? (
        <p style={{ color: "var(--muted)" }}>Für diese Figur liegen keine Details vor.</p>
      ) : (
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      )}
    </div>
  );
}

export function CharacterView() {
  const { game, uid, id } = useParams<{ game: GameId; uid: string; id: string }>();
  const { activeProfile } = useApp();
  const gameRef = activeProfile?.games.find((g) => g.game === game && g.uid === uid);
  return (
    <div className="space-y-2">
      <Link to={`/game/${game}/${uid}?tab=figuren`} className="inline-flex items-center min-h-11 text-indigo-400">
        ← {game ? GAME_TERMS[game]?.characters ?? "Figuren" : "Figuren"}
      </Link>
      {activeProfile && gameRef && id ? (
        <Body profile={activeProfile} gameRef={gameRef} id={id} />
      ) : (
        <p>Figur nicht gefunden.</p>
      )}
    </div>
  );
}
