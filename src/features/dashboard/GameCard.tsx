import { useState } from "react";
import { Link } from "react-router-dom";
import { useEvents, useGameArt, useGameStatus, useNow } from "../../app/hooks";
import { EVENT_ADAPTERS } from "../../api/events";
import { ERROR_TEXT } from "../../api/errors";
import { artworkStyle, Card, Chip, GameIcon, OverflowDot, ResourceBar, Skeleton, ValueText } from "../../components/ui";
import { formatClock, formatDuration, isFull } from "../../lib/time";
import { haptic } from "../../lib/native";
import { GAME_ACCENT, GAME_META } from "../../model/games";
import type { GameAccountRef, GameStatus, Profile } from "../../model/types";
import { eventSummary, weeklySummary } from "./taskSummary";
import { OpenEventsSheet, WeeklySheet } from "./TaskSheets";

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
  const daily = status.sections.find((s) => s.kind === "daily");

  return (
    <Card accent={accent}>
      {/* Nur Kopf und Stand führen in die Detailseite; die Aufgaben-Chips öffnen Popups und liegen deshalb außerhalb des Links */}
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
          {daily && daily.tasks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {daily.tasks.map((t) => (
                <Chip key={t.label} done={t.done >= t.total} iconKey={t.iconKey}>
                  {t.label} {t.done}/{t.total}
                </Chip>
              ))}
            </div>
          )}
          {stale && (
            <div className="text-xs" style={{ color: "var(--color-warn)" }}>
              {ERROR_TEXT[q.error.kind]} · Stand von {status.fetchedAt.toLocaleTimeString("de-DE")}
            </div>
          )}
        </div>
      </Link>
      <TaskChips profile={profile} gameRef={gameRef} status={status} now={now} accent={accent} detailPath={detailPath} dim={stale} />
    </Card>
  );
}

type SheetKind = "weekly" | "events";

/** Weekly- und Event-Chips; ein Tipp öffnet die Einzelheiten als Bottom Sheet, ohne die Karte zu verlassen. */
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

  const showWeekly = weekly.items.length > 0;
  const showEvents = hasEvents && (!events || events.running > 0);
  if (!showWeekly && !showEvents) return <div className="pb-4" />;

  const open = (s: SheetKind) => {
    haptic();
    setSheet(s);
  };
  const close = () => setSheet(null);
  const openText = (n: number) => (n === 0 ? "alle erledigt" : `${n} offen`);

  return (
    <div className={`p-4 pt-3 flex flex-wrap gap-2 ${dim ? "opacity-60" : ""}`}>
      {showWeekly && (
        <button
          type="button"
          className="active:opacity-70"
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
            className="active:opacity-70"
            onClick={() => open("events")}
            aria-haspopup="dialog"
            aria-label={events ? `Events: ${openText(events.open.length)}` : "Events: nicht abrufbar"}
          >
            <Chip done={!!events && events.open.length === 0}>
              {events ? <>Events{events.open.length > 0 && ` · ${events.open.length} offen`}</> : "Events · ?"}
            </Chip>
          </button>
        ) : (
          <span className="opacity-50" aria-label="Events werden geladen">
            <Chip done={false}>Events …</Chip>
          </span>
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
    </div>
  );
}
