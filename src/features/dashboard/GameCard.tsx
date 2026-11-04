import { useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentChallenges, useEvents, useGameArt, useGameStatus, useNow } from "../../app/hooks";
import { CHALLENGE_MODES } from "../../api/challenges";
import { EVENT_ADAPTERS } from "../../api/events";
import { ERROR_TEXT } from "../../api/errors";
import { artworkStyle, Card, Chip, GameIcon, OverflowDot, ResourceBar, Skeleton, ValueText } from "../../components/ui";
import { formatClock, formatDuration, isFull } from "../../lib/time";
import { haptic } from "../../lib/native";
import { GAME_ACCENT, GAME_META } from "../../model/games";
import type { GameAccountRef, GameStatus, Profile } from "../../model/types";
import { challengeSummary, eventSummary, weeklySummary } from "./taskSummary";
import { ChallengesSheet, OpenEventsSheet, WeeklySheet } from "./TaskSheets";

export function GameCard({ profile, gameRef }: { profile: Profile; gameRef: GameAccountRef }) {
  const meta = GAME_META[gameRef.game];
  const accent = GAME_ACCENT[gameRef.game];
  const q = useGameStatus(profile, gameRef);
  const art = useGameArt(profile).data?.[gameRef.game];
  const now = useNow();
  const status = q.data;
  const stale = q.isError && !!status;
  const detailPath = `/game/${gameRef.game}/${gameRef.uid}`;

  const header = (
    <div className="flex items-center gap-3 px-4 py-3" style={artworkStyle(meta.artworkKey, accent, 90, art?.artworkUrl)}>
      <GameIcon iconKey={meta.iconKey} url={art?.iconUrl} size={36} label={meta.name} />
      <div className="min-w-0">
        <div className="font-semibold leading-tight truncate">{meta.name}</div>
        <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
          {gameRef.nickname ?? status?.nickname ?? gameRef.uid} · {gameRef.uid}
        </div>
      </div>
    </div>
  );

  if (!status) {
    let body;
    if (q.isError) {
      const kind = q.error.kind;
      body = (
        <div className="p-4 space-y-2">
          <div className="font-medium" style={{ color: "var(--color-danger)" }}>
            {ERROR_TEXT[kind]}
          </div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            {q.error.message}
          </div>
          {(kind === "auth" || kind === "missing_credentials") && (
            <span className="inline-flex items-center min-h-11 text-indigo-400 underline">Zur Einrichtung</span>
          )}
        </div>
      );
    } else {
      body = (
        <div className="p-4 space-y-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      );
    }
    const content = (
      <Card accent={accent}>
        {header}
        {body}
      </Card>
    );
    const needsSetup = q.isError && (q.error.kind === "auth" || q.error.kind === "missing_credentials");
    return needsSetup ? <Link to="/accounts">{content}</Link> : content;
  }

  const p = status.primary;
  const full = isFull(p, now);


  return (
    <Card accent={accent}>
      {/* Nur Kopf und Stand führen in die Detailseite; die Chips öffnen teils Popups und liegen deshalb außerhalb des Links */}
      <Link to={detailPath} onClick={() => haptic()} className="block active:opacity-80">
        {header}
        <div className={`p-4 pb-0 space-y-3 ${stale ? "opacity-60" : ""}`}>
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <GameIcon iconKey={p.iconKey} size={32} label={p.label} />
              <span className="text-sm truncate" style={{ color: "var(--muted)" }}>
                {p.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-2xl font-semibold">
              <OverflowDot r={p} now={now} />
              <ValueText r={p} now={now} />
            </div>
          </div>
          <ResourceBar r={p} now={now} accent={accent} />
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            {full || !p.fullAt
              ? "Voll"
              : `Voll um ${formatClock(p.fullAt, now)} · in ${formatDuration(p.fullAt.getTime() - now)}`}
          </div>
        </div>
      </Link>
      <TaskChips profile={profile} gameRef={gameRef} status={status} now={now} accent={accent} detailPath={detailPath} dim={stale} />
      {stale && (
        <div className="px-4 pb-4 -mt-1 text-xs" style={{ color: "var(--color-warn)" }}>
          {ERROR_TEXT[q.error.kind]} · Stand von {status.fetchedAt.toLocaleTimeString("de-DE")}
        </div>
      )}
    </Card>
  );
}

type SheetKind = "weekly" | "events" | "challenges";

/** Daily-, Weekly-, Event- und Herausforderungen-Chips; ein Tipp auf alle außer Daily öffnet die Einzelheiten als Bottom Sheet, ohne die Karte zu verlassen. */
function TaskChips({
  profile,
  gameRef,
  status,
  now,
  accent,
  detailPath,
  dim,
}: {
  profile: Profile;
  gameRef: GameAccountRef;
  status: GameStatus;
  now: number;
  accent: string;
  detailPath: string;
  dim: boolean;
}) {
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const name = GAME_META[gameRef.game].name;
  const weekly = weeklySummary(status.sections.find((s) => s.kind === "weekly"));
  // Wuthering Waves liefert nur Banner: keine Events zum Erledigen, also auch kein Abruf.
  const adapter = EVENT_ADAPTERS[gameRef.game];
  const hasEvents = !!adapter && !adapter.bannersOnly;
  const eq = useEvents(profile, gameRef, hasEvents);
  const events = eq.data ? eventSummary(eq.data.events, now) : undefined;

  // Laufende Periode aller Modi; teilt sich den Cache mit dem Tab Herausforderungen und der Zeitleiste.
  const modes = CHALLENGE_MODES[gameRef.game] ?? [];
  const cq = useCurrentChallenges(
    profile,
    modes.map((mode) => ({ ref: gameRef, mode })),
  );
  const challengeResults = modes.map((mode, i) => ({ mode, data: cq[i]?.data, error: cq[i]?.error }));
  const challenges = challengeSummary(cq, now);

  const dailyTasks = status.sections.find((s) => s.kind === "daily")?.tasks ?? [];

  const showWeekly = weekly.items.length > 0;
  const showEvents = hasEvents && (!events || events.running > 0);
  // Ohne mitgezählten Modus (alle gesperrt) entfällt der Chip; schlagen alle Abrufe fehl, steht "?" da.
  const showChallenges = modes.length > 0 && (challenges.loading > 0 || challenges.counted > 0 || challenges.failed > 0);
  if (dailyTasks.length === 0 && !showWeekly && !showEvents && !showChallenges) return <div className="pb-4" />;

  const open = (s: SheetKind) => {
    haptic();
    setSheet(s);
  };
  const close = () => setSheet(null);
  const openText = (n: number) => (n === 0 ? "alle erledigt" : `${n} offen`);

  return (
    // Eine Reihe für alle Chips: auf breiten Karten stehen sie nebeneinander, erst bei Platzmangel rutschen sie in die nächste Zeile
    <div className={`px-4 pt-1.5 pb-2.5 flex flex-wrap items-center gap-x-2 ${dim ? "opacity-60" : ""}`}>
      {dailyTasks.map((t) => (
        <span key={t.label} className="min-h-11 inline-flex items-center">
          <Chip done={t.done >= t.total} iconKey={t.iconKey}>
            {t.label} {t.done}/{t.total}
          </Chip>
        </span>
      ))}
      {showWeekly && (
        <button
          type="button"
          className="min-h-11 inline-flex items-center rounded-full active:opacity-70"
          onClick={() => open("weekly")}
          aria-haspopup="dialog"
          aria-label={`Wöchentliche Aufgaben: ${openText(weekly.open)}`}
        >
          <Chip done={weekly.open === 0}>Wöchentlich{weekly.open > 0 && ` · ${weekly.open} offen`}</Chip>
        </button>
      )}
      {showEvents &&
        (events || eq.isError ? (
          <button
            type="button"
            className="min-h-11 inline-flex items-center rounded-full active:opacity-70"
            onClick={() => open("events")}
            aria-haspopup="dialog"
            aria-label={events ? `Events: ${openText(events.open.length)}` : "Events: nicht abrufbar"}
          >
            <Chip done={!!events && events.open.length === 0}>
              {events ? <>Events{events.open.length > 0 && ` · ${events.open.length} offen`}</> : "Events · ?"}
            </Chip>
          </button>
        ) : (
          <span className="min-h-11 inline-flex items-center opacity-50" aria-label="Events werden geladen">
            <Chip done={false}>Events …</Chip>
          </span>
        ))}
      {showChallenges &&
        (challenges.loading > 0 ? (
          <span className="min-h-11 inline-flex items-center opacity-50" aria-label="Herausforderungen werden geladen">
            <Chip done={false}>Herausforderungen …</Chip>
          </span>
        ) : (
          <button
            type="button"
            className="min-h-11 inline-flex items-center rounded-full active:opacity-70"
            onClick={() => open("challenges")}
            aria-haspopup="dialog"
            aria-label={
              challenges.counted > 0 ? `Herausforderungen: ${openText(challenges.open)}` : "Herausforderungen: nicht abrufbar"
            }
          >
            <Chip done={challenges.counted > 0 && challenges.open === 0}>
              {challenges.counted > 0 ? (
                <>Herausforderungen{challenges.open > 0 && ` · ${challenges.open} offen`}</>
              ) : (
                "Herausforderungen · ?"
              )}
            </Chip>
          </button>
        ))}
      <WeeklySheet open={sheet === "weekly"} onClose={close} title={`${name} · Wöchentlich`} summary={weekly} accent={accent} />
      {hasEvents && (
        <OpenEventsSheet
          open={sheet === "events"}
          onClose={close}
          title={`${name} · Offene Events`}
          events={events?.open ?? []}
          error={events ? undefined : (eq.error ?? undefined)}
          now={now}
          accent={accent}
          detailPath={detailPath}
        />
      )}
      {modes.length > 0 && (
        <ChallengesSheet
          open={sheet === "challenges"}
          onClose={close}
          title={`${name} · Herausforderungen`}
          results={challengeResults}
          now={now}
          accent={accent}
          detailPath={detailPath}
        />
      )}
    </div>
  );
}
