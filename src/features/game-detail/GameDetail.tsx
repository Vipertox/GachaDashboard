import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/state";
import { statusKey, useGameArt, useGameStatus, useNow } from "../../app/hooks";
import { ERROR_TEXT } from "../../api/errors";
import {
  artworkStyle,
  Card,
  Chip,
  GameIcon,
  OverflowDot,
  ProgressBar,
  ResourceBar,
  Ring,
  Skeleton,
  useCountUp,
  ValueText,
  type BarMode,
} from "../../components/ui";
import { formatClock, formatCountdown, formatDuration, fraction, isFull, liveValue } from "../../lib/time";
import { GAME_ACCENT, GAME_META, GAME_TERMS } from "../../model/games";
import type { DetailSection, GameAccountRef, GameId, GameStatus, Profile, Resource } from "../../model/types";
import { CHALLENGE_MODES } from "../../api/challenges";
import { ChallengeSummary, Challenges } from "./Challenges";
import { EventsSection } from "./Events";
import { Roster } from "./Roster";

type Tab = "uebersicht" | "figuren" | "herausforderungen";

const TITLES: Record<DetailSection["kind"], string> = {
  daily: "Täglich",
  weekly: "Wöchentlich",
  running: "Laufend",
  other: "Weitere Ressourcen",
  collection: "Sammlung",
  account: "Konto",
};

function ResourceRow({ r, now, accent, mode }: { r: Resource; now: number; accent: string; mode: BarMode }) {
  const full = isFull(r, now);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <GameIcon iconKey={r.iconKey} size={28} label={r.label} />
          <span className="truncate">{r.label}</span>
        </div>
        <ValueText r={r} now={now} className="font-semibold shrink-0 whitespace-nowrap" />
      </div>
      <ResourceBar r={r} now={now} accent={accent} mode={mode} />
      {mode === "overflow" && full && (
        <div className="text-xs font-semibold" style={{ color: "var(--color-danger)" }}>
          Voll
        </div>
      )}
      {r.fullAt && !full && (
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          Voll in {formatDuration(r.fullAt.getTime() - now)}
        </div>
      )}
    </div>
  );
}

function Section({ s, now, accent }: { s: DetailSection; now: number; accent: string }) {
  const timers = [...s.timers].sort((a, b) => a.readyAt.getTime() - b.readyAt.getTime());
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {TITLES[s.kind]}
      </h2>
      <Card>
        <div className="p-4 space-y-4">
          {s.tasks.length > 0 && (
            <div className="space-y-3">
              {s.tasks.map((t) => (
                <div key={t.label} className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2">
                      {t.done >= t.total && <span style={{ color: "var(--color-ok)" }}>✓</span>}
                      {t.label}
                    </span>
                    <span className="font-semibold">
                      {t.done}/{t.total}
                    </span>
                  </div>
                  <ProgressBar frac={t.total ? Math.min(1, t.done / t.total) : 0} accent={accent} height={6} mode="progress" />
                </div>
              ))}
            </div>
          )}
          {s.flags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {s.flags.map((f) => (
                <Chip key={f.label} done={f.done}>
                  {f.label}
                  {f.text ? `: ${f.text}` : ""}
                </Chip>
              ))}
            </div>
          )}
          {s.resources.map((r) => (
            <ResourceRow key={r.label} r={r} now={now} accent={accent} mode={s.kind === "other" ? "overflow" : "progress"} />
          ))}
          {s.facts.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {s.facts.map((f) => (
                <div key={f.label} className={f.value.length > 14 ? "col-span-2" : ""}>
                  <dt style={{ color: "var(--muted)" }}>{f.label}</dt>
                  <dd className="font-semibold">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {timers.length > 0 && (
            <ul className="space-y-3">
              {timers.map((t, i) => {
                const left = t.readyAt.getTime() - now;
                return (
                  <li key={`${t.label}-${i}`} className="flex items-center gap-3">
                    <GameIcon url={t.iconUrl} size={40} round label={t.label} />
                    <span className="flex-1 truncate">{t.label}</span>
                    <span className="font-semibold" style={{ color: left <= 0 ? "var(--color-ok)" : undefined }}>
                      {left <= 0 ? "✓ Fertig" : formatCountdown(left)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </section>
  );
}

function Head({
  s,
  now,
  accent,
  artworkKey,
  artworkUrl,
  gameName,
}: {
  s: GameStatus;
  now: number;
  accent: string;
  artworkKey: string;
  artworkUrl?: string;
  gameName: string;
}) {
  const p = s.primary;
  const value = useCountUp(liveValue(p, now));
  // Reserve bzw. Waveplate Crystal gehören laut Konzept in den Kopf, nicht in einen Abschnitt.
  const extras = s.secondary.filter((r) => !s.sections.some((sec) => sec.resources.includes(r)));
  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ ...artworkStyle(artworkKey, accent, 135, artworkUrl), border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-4">
        <Ring frac={fraction(p, now)} accent={accent}>
          <GameIcon iconKey={p.iconKey} size={44} label={p.label} />
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            {gameName} · {s.nickname}
          </div>
          <div className="text-3xl font-bold flex items-center gap-2">
            <OverflowDot r={p} now={now} />
            {value}
            <span className="text-lg font-normal" style={{ color: "var(--muted)" }}>
              / {p.max}
            </span>
          </div>
          <div className="text-sm">{p.label}</div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            {isFull(p, now) || !p.fullAt
              ? "Voll"
              : `Voll um ${formatClock(p.fullAt, now)} · ${formatCountdown(p.fullAt.getTime() - now)}`}
          </div>
        </div>
      </div>
      {extras.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-sm">
          <GameIcon iconKey={r.iconKey} size={24} label={r.label} />
          <span className="flex-1 truncate">{r.label}</span>
          <ValueText r={r} now={now} className="font-semibold shrink-0 whitespace-nowrap" />
          {isFull(r, now) && (
            <span className="text-xs font-semibold" style={{ color: "var(--color-danger)" }}>
              Voll
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Im Figuren-Tab bleibt die Hauptressource als eine Zeile sichtbar. */
function CompactHead({ s, now, accent }: { s: GameStatus; now: number; accent: string }) {
  const p = s.primary;
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <GameIcon iconKey={p.iconKey} size={24} label={p.label} />
      <div className="flex-1 min-w-0">
        <ResourceBar r={p} now={now} accent={accent} />
      </div>
      <ValueText r={p} now={now} className="text-sm font-semibold" />
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        {isFull(p, now) || !p.fullAt ? "Voll" : `voll in ${formatCountdown(p.fullAt.getTime() - now)}`}
      </span>
    </div>
  );
}

function Body({ profile, gameRef }: { profile: Profile; gameRef: GameAccountRef }) {
  const q = useGameStatus(profile, gameRef);
  const qc = useQueryClient();
  const now = useNow();
  const accent = GAME_ACCENT[gameRef.game];
  const meta = GAME_META[gameRef.game];
  const art = useGameArt(profile).data?.[gameRef.game];
  const { game, uid } = gameRef;

  // Die Detailseite lädt beim Öffnen neu, nutzt sonst dieselbe Antwort wie das Dashboard.
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: statusKey(profile.id, { game, uid }) });
  }, [qc, profile.id, game, uid]);

  // Der Tab steht in der URL, damit der Zurück-Knopf unter Android wie erwartet funktioniert.
  const [params, setParams] = useSearchParams();
  const tabList: [Tab, string][] = [
    ["uebersicht", "Übersicht"],
    ["figuren", GAME_TERMS[game].characters],
  ];
  if (CHALLENGE_MODES[game]) tabList.push(["herausforderungen", "Herausforderungen"]);
  const tab = tabList.find(([key]) => key === params.get("tab"))?.[0] ?? "uebersicht";
  const openTab = (key: Tab) => setParams(key === "uebersicht" ? {} : { tab: key }, { replace: true });
  const tabs = (
    <div className="flex rounded-xl p-1 gap-1" role="tablist" style={{ background: "var(--surface-2)" }}>
      {tabList.map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={tab === key}
          className="flex-1 min-w-0 min-h-10 px-1 rounded-lg text-sm font-medium truncate"
          style={tab === key ? { background: "var(--surface)", boxShadow: `inset 0 -2px 0 ${accent}` } : { color: "var(--muted)" }}
          onClick={() => openTab(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const s = q.data;
  if (tab === "figuren") {
    return (
      <div className="space-y-4">
        {s && <CompactHead s={s} now={now} accent={accent} />}
        {tabs}
        <Roster profile={profile} gameRef={gameRef} status={s} />
      </div>
    );
  }
  if (tab === "herausforderungen") {
    return (
      <div className="space-y-4">
        {s && <CompactHead s={s} now={now} accent={accent} />}
        {tabs}
        <Challenges profile={profile} gameRef={gameRef} accent={accent} />
      </div>
    );
  }
  if (!s) {
    return q.isError ? (
      <p style={{ color: "var(--color-danger)" }}>{ERROR_TEXT[q.error.kind]}: {q.error.message}</p>
    ) : (
      <div className="space-y-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  // Die Herausforderungen stehen direkt unter Wöchentlich, ohne diesen Abschnitt nach Täglich.
  const weekly = s.sections.findIndex((sec) => sec.kind === "weekly");
  const summaryAt = weekly >= 0 ? weekly + 1 : s.sections.filter((sec) => sec.kind === "daily").length;
  return (
    <div className={`space-y-5 ${q.isError ? "opacity-70" : ""}`}>
      <Head s={s} now={now} accent={accent} artworkKey={meta.artworkKey} artworkUrl={art?.artworkUrl} gameName={meta.name} />
      {tabs}
      {s.sections.slice(0, summaryAt).map((sec) => (
        <Section key={sec.kind} s={sec} now={now} accent={accent} />
      ))}
      <ChallengeSummary profile={profile} gameRef={gameRef} onOpen={() => openTab("herausforderungen")} />
      <EventsSection profile={profile} gameRef={gameRef} accent={accent} />
      {s.sections.slice(summaryAt).map((sec) => (
        <Section key={sec.kind} s={sec} now={now} accent={accent} />
      ))}
      <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
        Stand vom {s.fetchedAt.toLocaleTimeString("de-DE")}
        {q.isError ? ` · ${ERROR_TEXT[q.error.kind]}` : ""}
      </p>
    </div>
  );
}

export function GameDetail() {
  const { game, uid } = useParams<{ game: GameId; uid: string }>();
  const { activeProfile } = useApp();
  const gameRef = activeProfile?.games.find((g) => g.game === game && g.uid === uid);
  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex items-center min-h-11 text-indigo-400">
        ← Dashboard
      </Link>
      {activeProfile && gameRef ? <Body profile={activeProfile} gameRef={gameRef} /> : <p>Spiel nicht gefunden.</p>}
    </div>
  );
}
