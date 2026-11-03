import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../app/state";
import { useCurrentChallenges, useEventCalendars, useNow, visibleGames } from "../../app/hooks";
import { CHALLENGE_MODES } from "../../api/challenges";
import { EVENT_ADAPTERS } from "../../api/events";
import { ERROR_TEXT, type ApiError } from "../../api/errors";
import { btnPrimary, Card, GameIcon, Skeleton } from "../../components/ui";
import { formatDuration } from "../../lib/time";
import { GAME_ACCENT, GAME_META } from "../../model/games";
import type { Banner, GameAccountRef, GameEvent, GameId, Profile } from "../../model/types";
import { BannerSheet, EventSheet } from "../game-detail/Events";
import {
  barSpan,
  dayTicks,
  endingSoon,
  fromCalendar,
  fromChallenge,
  itemOrder,
  KIND_LABEL,
  KINDS,
  loadTimelinePrefs,
  position,
  saveTimelinePrefs,
  timelineWindow,
  toggle,
  type TimelineItem,
  type TimelinePrefs,
} from "./timelineView";

// Unter dieser Breite pro Tag wird waagerecht gescrollt, sonst füllt der Zeitraum die Karte.
const MIN_DAY_PX = 36;
const ROW_PX = 40;
const NOW_COLOR = "#818cf8";

const hasTimeline = (g: GameId) => !!EVENT_ADAPTERS[g] || !!CHALLENGE_MODES[g];
const refKey = (r: GameAccountRef) => `${r.game}-${r.uid}`;

/** 10102 heißt hier, dass die Kampfchronik in HoYoLAB nicht öffentlich ist. */
function errorText(e: ApiError): string {
  return e.kind === "notes_disabled"
    ? "Kampfchronik in HoYoLAB unter Datenschutz freigeben"
    : `${ERROR_TEXT[e.kind]}: ${e.message}`;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const fmtDay = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
const fmtWeekday = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
const fmtMonth = (d: Date) => d.toLocaleDateString("de-DE", { month: "short" }).replace(".", "");

function whenText(i: TimelineItem, now: number): string {
  const range = [i.start && fmtDay(i.start), i.end && fmtDay(i.end)].filter(Boolean).join("–");
  if (i.status === "upcoming" && i.start) return `${range}, startet in ${formatDuration(i.start.getTime() - now)}`;
  if (i.end) return `${range}, endet in ${formatDuration(i.end.getTime() - now)}`;
  return range;
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-pressed={on}
      className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-9 text-sm"
      style={on ? { background: "var(--surface)", border: "1px solid var(--border)" } : { color: "var(--muted)", border: "1px dashed var(--border)" }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Tageskopf mit Wochentag und Datum, am Monatsanfang zusätzlich der Monat. */
function DayHeader({ ticks, dayPx, now }: { ticks: number[]; dayPx: number; now: number }) {
  const today = new Date(now).toDateString();
  return (
    <div className="relative flex h-10 border-b border-[var(--border)]">
      {ticks.map((t, n) => {
        const d = new Date(t);
        const isToday = d.toDateString() === today;
        return (
          <div
            key={t}
            className="shrink-0 flex flex-col items-center justify-center text-[11px] leading-tight"
            style={{ width: dayPx, color: isToday ? NOW_COLOR : "var(--muted)", fontWeight: isToday ? 700 : undefined }}
          >
            <span>{n === 0 || d.getDate() === 1 ? fmtMonth(d) : fmtWeekday(d)}</span>
            <span>{d.getDate()}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Wochenenden leicht abgesetzt, damit die Wochen lesbar bleiben. */
function DayGrid({ ticks, dayPx }: { ticks: number[]; dayPx: number }) {
  return (
    <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
      {ticks.map((t) => {
        const wd = new Date(t).getDay();
        return (
          <div
            key={t}
            className="shrink-0 h-full border-l border-[var(--border)]"
            style={{ width: dayPx, background: wd === 0 || wd === 6 ? "color-mix(in srgb, var(--surface-2) 55%, transparent)" : undefined, opacity: 0.8 }}
          />
        );
      })}
    </div>
  );
}

function Bar({ i, left, width, openStart, openEnd, now, onOpen }: {
  i: TimelineItem;
  left: number;
  width: number;
  openStart: boolean;
  openEnd: boolean;
  now: number;
  onOpen: () => void;
}) {
  const accent = GAME_ACCENT[i.game];
  const soon = endingSoon(i, now);
  const done = i.status === "done";
  const upcoming = i.status === "upcoming";
  const radius = `${openStart ? 0 : 6}px ${openEnd ? 0 : 6}px ${openEnd ? 0 : 6}px ${openStart ? 0 : 6}px`;
  const fade = openEnd ? "linear-gradient(to right, #000 85%, transparent)" : openStart ? "linear-gradient(to left, #000 85%, transparent)" : undefined;
  const track: CSSProperties = upcoming
    ? { border: `1.5px dashed ${accent}`, background: `color-mix(in srgb, ${accent} 12%, transparent)` }
    : done
      ? { background: "color-mix(in srgb, var(--color-ok) 40%, transparent)" }
      : { background: i.progress === undefined ? accent : `color-mix(in srgb, ${accent} 30%, transparent)` };
  return (
    <button
      className="absolute top-0 h-full text-left active:opacity-70 overflow-visible"
      style={{ left, width: Math.max(width, 6) }}
      aria-label={`${i.name}, ${whenText(i, now)}`}
      title={whenText(i, now)}
      onClick={onOpen}
    >
      <span
        className="sticky left-2 inline-flex items-center gap-1 max-w-[80vw] whitespace-nowrap text-xs h-6 pr-1"
        style={{ color: done ? "var(--muted)" : soon ? "var(--color-warn)" : undefined }}
      >
        {done && <span style={{ color: "var(--color-ok)" }}>✓</span>}
        {soon && <span aria-hidden>⚠</span>}
        {i.icons.slice(0, 3).map((ic, n) => (
          <GameIcon key={`${ic.label}-${n}`} url={ic.url} size={18} round label={ic.label} />
        ))}
        <span className="font-medium truncate">{i.name}</span>
        {i.note && <span style={{ color: "var(--muted)" }}>· {i.note}</span>}
      </span>
      <span
        className="absolute bottom-1.5 inset-x-0 h-3 overflow-hidden"
        style={{ ...track, borderRadius: radius, maskImage: fade, WebkitMaskImage: fade }}
      >
        {!upcoming && !done && i.progress !== undefined && (
          <span className="absolute inset-y-0 left-0" style={{ width: `${i.progress * 100}%`, background: accent }} />
        )}
      </span>
    </button>
  );
}

/** Zeile, deren Text beim waagerechten Scrollen links stehen bleibt. */
function StickyRow({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`relative ${className}`} style={style}>
      <span className="sticky left-3 inline-flex items-center gap-2">{children}</span>
    </div>
  );
}

interface GameLane {
  ref: GameAccountRef;
  items: TimelineItem[];
  loading: boolean;
  eventError?: ApiError;
  challengeError?: ApiError;
}

/**
 * Zeitleiste der Banner, Events und Herausforderungen. Mit mehreren Spielen (`showGames`) steht jedes
 * Spiel unter einer eigenen Kopfzeile und lässt sich ausblenden.
 */
export function Timeline({ profile, refs, showGames }: { profile: Profile; refs: GameAccountRef[]; showGames: boolean }) {
  const now = useNow();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<TimelinePrefs>(loadTimelinePrefs);
  const [open, setOpen] = useState<{ event?: GameEvent; banner?: Banner }>({});
  const [scrollRef, width] = useWidth();

  const all = refs.filter((r) => hasTimeline(r.game));
  const shown = showGames ? all.filter((r) => !prefs.hiddenGames.includes(r.game)) : all;
  const calendars = useEventCalendars(profile, shown);
  const challengeList = shown.flatMap((ref) => (CHALLENGE_MODES[ref.game] ?? []).map((mode) => ({ ref, mode })));
  const challenges = useCurrentChallenges(profile, challengeList);

  const update = (p: TimelinePrefs) => {
    setPrefs(p);
    saveTimelinePrefs(p);
  };

  const lanes: GameLane[] = shown.map((ref, n) => {
    const cal = calendars[n];
    const own = challengeList.map((x, k) => ({ ...x, q: challenges[k] })).filter((x) => x.ref === ref);
    const items = [
      ...(cal.data ? fromCalendar(ref.game, cal.data) : []),
      ...own.flatMap((x) => (x.q.data ? (fromChallenge(ref.game, x.mode, x.q.data, now) ?? []) : [])),
    ].filter((i) => !prefs.hiddenKinds.includes(i.kind));
    const failed = own.filter((x) => x.q.isError);
    return {
      ref,
      items,
      loading: (!!EVENT_ADAPTERS[ref.game] && cal.isPending) || own.some((x) => x.q.isPending),
      eventError: cal.error ?? undefined,
      // Ein Hinweis genügt, wenn alle Modi scheitern; einzelne Lücken bleiben still.
      challengeError: own.length > 0 && failed.length === own.length ? (failed[0].q.error ?? undefined) : undefined,
    };
  });

  const win = timelineWindow(lanes.flatMap((l) => l.items), now);
  const ticks = dayTicks(win);
  const dayPx = Math.max(MIN_DAY_PX, width / win.days || 0);
  const total = dayPx * win.days;
  const x = (frac: number) => frac * total;

  const openItem = (i: TimelineItem, ref: GameAccountRef) => {
    if (i.source.type === "event") setOpen({ event: i.source.event });
    else if (i.source.type === "banner") setOpen({ banner: i.source.banner });
    else navigate(`/game/${ref.game}/${ref.uid}?tab=herausforderungen`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <FilterChip
            key={k}
            on={!prefs.hiddenKinds.includes(k)}
            onClick={() => update({ ...prefs, hiddenKinds: toggle(prefs.hiddenKinds, k) })}
          >
            {KIND_LABEL[k]}
          </FilterChip>
        ))}
        {showGames &&
          [...new Set(all.map((r) => r.game))].map((g) => (
            <FilterChip
              key={g}
              on={!prefs.hiddenGames.includes(g)}
              onClick={() => update({ ...prefs, hiddenGames: toggle(prefs.hiddenGames, g) })}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: GAME_ACCENT[g] }} />
              {GAME_META[g].name}
            </FilterChip>
          ))}
      </div>
      <Card>
        <div ref={scrollRef} className="overflow-x-auto">
          <div className="relative pb-2" style={{ width: total }}>
            <DayGrid ticks={ticks} dayPx={dayPx} />
            <DayHeader ticks={ticks} dayPx={dayPx} now={now} />
            {lanes.length === 0 && (
              <StickyRow className="py-4 text-sm" style={{ color: "var(--muted)" }}>
                Kein Spiel ausgewählt.
              </StickyRow>
            )}
            {lanes.map((l) => (
              <div key={refKey(l.ref)} className="relative">
                {showGames && (
                  <StickyRow className="pt-3 pb-1 font-semibold text-sm">
                    <GameIcon iconKey={GAME_META[l.ref.game].iconKey} size={22} label={GAME_META[l.ref.game].name} />
                    {GAME_META[l.ref.game].name}
                    {l.ref.nickname && (
                      <span className="font-normal" style={{ color: "var(--muted)" }}>
                        · {l.ref.nickname}
                      </span>
                    )}
                  </StickyRow>
                )}
                {l.eventError && (
                  <StickyRow className="py-1 text-xs" style={{ color: "var(--color-danger)" }}>
                    Events: {errorText(l.eventError)}
                  </StickyRow>
                )}
                {l.challengeError && (
                  <StickyRow className="py-1 text-xs" style={{ color: "var(--color-danger)" }}>
                    Herausforderungen: {errorText(l.challengeError)}
                  </StickyRow>
                )}
                {KINDS.filter((k) => !prefs.hiddenKinds.includes(k)).map((k) => {
                  const rows = l.items
                    .filter((i) => i.kind === k)
                    .sort(itemOrder)
                    .map((i) => ({ i, span: barSpan(i, win) }))
                    .filter((r) => r.span);
                  if (rows.length === 0) return null;
                  return (
                    <div key={k}>
                      <StickyRow className="pt-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                        {KIND_LABEL[k]}
                      </StickyRow>
                      {rows.map(({ i, span }) => (
                        <div key={i.key} className="relative" style={{ height: ROW_PX }}>
                          <Bar
                            i={i}
                            left={x(span!.left)}
                            width={x(span!.width)}
                            openStart={span!.openStart}
                            openEnd={span!.openEnd}
                            now={now}
                            onOpen={() => openItem(i, l.ref)}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
                {l.loading && (
                  <div className="px-3 py-2">
                    <Skeleton className="h-8 w-48" />
                  </div>
                )}
                {!l.loading && !l.eventError && !l.challengeError && l.items.length === 0 && (
                  <StickyRow className="py-2 text-sm" style={{ color: "var(--muted)" }}>
                    Keine Einträge im Zeitraum.
                  </StickyRow>
                )}
              </div>
            ))}
            <div
              className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
              style={{ left: x(position(now, win)), background: NOW_COLOR }}
              aria-hidden
            />
          </div>
        </div>
      </Card>
      <EventSheet e={open.event} onClose={() => setOpen({})} />
      <BannerSheet b={open.banner} onClose={() => setOpen({})} />
    </div>
  );
}

/** Eigene Seite in der Navigation: alle sichtbaren Spiele des aktiven Profils. */
export function TimelinePage() {
  const { activeProfile } = useApp();
  if (!activeProfile) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-lg">Noch kein Profil angelegt.</p>
        <Link to="/accounts?new=1" className={btnPrimary}>
          Einrichtung starten
        </Link>
      </div>
    );
  }
  const refs = visibleGames(activeProfile);
  const without = refs.filter((r) => !hasTimeline(r.game));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Zeitleiste</h1>
      {refs.some((r) => hasTimeline(r.game)) ? (
        <Timeline profile={activeProfile} refs={refs} showGames />
      ) : (
        <p style={{ color: "var(--muted)" }}>Für die sichtbaren Spiele gibt es keine Events, Banner oder Herausforderungen.</p>
      )}
      {without.length > 0 && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Nicht enthalten: {without.map((r) => GAME_META[r.game].name).join(", ")}. Die Schnittstelle liefert dazu keine Events.
        </p>
      )}
    </div>
  );
}
