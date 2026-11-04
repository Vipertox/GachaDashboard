import { GAME_IDS, type Banner, type Challenge, type ChallengeMode, type EventCalendar, type EventStatus, type GameEvent, type GameId } from "../../model/types";

export type TimelineKind = "banner" | "event" | "challenge";

/** Reihenfolge der Bereiche je Spiel. */
export const KINDS: TimelineKind[] = ["banner", "event", "challenge"];

export const KIND_LABEL: Record<TimelineKind, string> = {
  banner: "Banner",
  event: "Events",
  challenge: "Herausforderungen",
};

export type TimelineSource =
  | { type: "event"; event: GameEvent }
  | { type: "banner"; banner: Banner }
  | { type: "challenge"; mode: string };

/** Ein Balken der Zeitleiste. */
export interface TimelineItem {
  key: string;
  kind: TimelineKind;
  game: GameId;
  name: string;
  start?: Date;
  end?: Date;
  status: EventStatus;
  /** Kurztext hinter dem Namen, z. B. "30/36 Sterne". */
  note?: string;
  /** Bei Bannern die Figuren bzw. Waffen der höchsten Seltenheit. */
  icons: { url?: string; label: string }[];
  /** Erledigter Anteil von 0 bis 1, füllt den Balken. */
  progress?: number;
  source: TimelineSource;
}

const frac = (p: { current: number; max: number } | undefined) =>
  p && p.max ? Math.min(1, Math.max(0, p.current / p.max)) : undefined;

/** Events und Banner eines Spiels als Balken. */
export function fromCalendar(game: GameId, cal: EventCalendar): TimelineItem[] {
  const events = cal.events.map(
    (e): TimelineItem => ({
      key: `${game}-event-${e.id}`,
      kind: "event",
      game,
      name: e.name,
      start: e.start,
      end: e.end,
      status: e.status,
      note: e.tag,
      icons: [],
      progress: e.status === "upcoming" ? undefined : frac(e.progress),
      source: { type: "event", event: e },
    }),
  );
  const banners = cal.banners.map((b): TimelineItem => {
    const top = Math.max(0, ...b.items.map((i) => i.rarity));
    return {
      key: `${game}-banner-${b.id}`,
      kind: "banner",
      game,
      name: b.name,
      start: b.start,
      end: b.end,
      status: b.status,
      note: b.version ? `Version ${b.version}` : undefined,
      icons: b.items.filter((i) => i.rarity === top).map((i) => ({ url: i.iconUrl, label: i.name })),
      source: { type: "banner", banner: b },
    };
  });
  return [...banners, ...events];
}

/**
 * Aktuelle Periode eines Endgame-Modus. Ohne Ende oder wenn der Modus gesperrt ist, gibt es keinen Balken.
 * Voller Fortschritt gilt als erledigt.
 */
export function fromChallenge(game: GameId, mode: ChallengeMode, c: Challenge, now: number): TimelineItem | undefined {
  if (!c.end || c.state === "locked") return undefined;
  const p = frac(c.progress);
  let status: EventStatus = "running";
  if (c.start && c.start.getTime() > now) status = "upcoming";
  else if (p === 1) status = "done";
  return {
    key: `${game}-challenge-${mode.key}`,
    kind: "challenge",
    game,
    name: mode.label,
    start: c.start,
    end: c.end,
    status,
    note: c.state === "empty" ? "Nicht gespielt" : c.summary,
    icons: [],
    progress: p,
    source: { type: "challenge", mode: mode.key },
  };
}

const DAY = 86400_000;

/** Mitternacht in lokaler Zeit; über `setDate`, damit die Zeitumstellung keine Tage verschiebt. */
export function addDays(t: number, n: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export interface TimelineWindow {
  from: number;
  to: number;
  days: number;
}

/**
 * Sichtbarer Zeitraum: ab `before` Tagen vor heute bis zum spätesten bekannten Ende bzw. Beginn,
 * mindestens `min` und höchstens `max` Tage.
 */
export function timelineWindow(items: TimelineItem[], now: number, { before = 3, min = 14, max = 42 } = {}): TimelineWindow {
  const from = addDays(now, -before);
  const last = Math.max(now, ...items.map((i) => (i.end ?? i.start)?.getTime() ?? now));
  const needed = Math.round((addDays(last, 1) - from) / DAY);
  const days = Math.min(max, Math.max(min, needed));
  return { from, to: addDays(from, days), days };
}

/** Mitternacht jedes sichtbaren Tages. */
export function dayTicks(win: TimelineWindow): number[] {
  return Array.from({ length: win.days }, (_, i) => addDays(win.from, i));
}

/** Anteil von 0 bis 1 am Zeitraum. */
export function position(t: number, win: TimelineWindow): number {
  return (t - win.from) / (win.to - win.from);
}

export interface BarSpan {
  left: number;
  width: number;
  /** Beginnt vor bzw. endet nach dem sichtbaren Zeitraum oder hat kein Datum. */
  openStart: boolean;
  openEnd: boolean;
}

/** Lage des Balkens als Anteil; außerhalb des Zeitraums keiner. */
export function barSpan(item: Pick<TimelineItem, "start" | "end">, win: TimelineWindow): BarSpan | undefined {
  const s = item.start?.getTime() ?? -Infinity;
  const e = item.end?.getTime() ?? Infinity;
  if (e <= win.from || s >= win.to) return undefined;
  const left = position(Math.max(s, win.from), win);
  const right = position(Math.min(e, win.to), win);
  return { left, width: right - left, openStart: s < win.from, openEnd: e > win.to };
}

/** Nach Beginn, ohne Beginn zuerst; dann nach Ende, dann nach Name. */
export function itemOrder(a: TimelineItem, b: TimelineItem): number {
  const start = (x: TimelineItem) => x.start?.getTime() ?? -Infinity;
  const end = (x: TimelineItem) => x.end?.getTime() ?? Infinity;
  return start(a) - start(b) || end(a) - end(b) || a.name.localeCompare(b.name, "de");
}

// Wie bei Events und Herausforderungen: ab drei Tagen vor Ende wird ein offener Eintrag hervorgehoben.
const ENDING_SOON_MS = 3 * DAY;

export function endingSoon(item: TimelineItem, now: number): boolean {
  if (item.status !== "running" || !item.end) return false;
  const left = item.end.getTime() - now;
  return left > 0 && left < ENDING_SOON_MS;
}

export interface TimelinePrefs {
  hiddenKinds: TimelineKind[];
  hiddenGames: GameId[];
}

const DEFAULT: TimelinePrefs = { hiddenKinds: [], hiddenGames: [] };

/** Nur bekannte Werte übernehmen; ein alter oder kaputter Eintrag darf die Seite nicht abstürzen lassen. */
function knownValues<T extends string>(value: unknown, known: readonly T[]): T[] {
  return Array.isArray(value) ? value.filter((v): v is T => known.includes(v as T)) : [];
}

/** Reine Anzeige-Einstellung; fehlt der Speicher oder ist er unlesbar, ist alles sichtbar. */
export function loadTimelinePrefs(): TimelinePrefs {
  try {
    const raw = localStorage.getItem("timeline");
    if (!raw) return DEFAULT;
    const stored = JSON.parse(raw) as Partial<Record<keyof TimelinePrefs, unknown>> | null;
    return {
      hiddenKinds: knownValues(stored?.hiddenKinds, KINDS),
      hiddenGames: knownValues(stored?.hiddenGames, GAME_IDS),
    };
  } catch {
    return DEFAULT;
  }
}

export function saveTimelinePrefs(prefs: TimelinePrefs): void {
  try {
    localStorage.setItem("timeline", JSON.stringify(prefs));
  } catch {
    // Privater Modus o. Ä.: Einstellung gilt nur bis zum Neuladen.
  }
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
