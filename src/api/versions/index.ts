import { ApiError } from "../errors";
import type { Banner, GameId, VersionFacts, VersionInfo } from "../../model/types";
import { fetchHoyoAnnouncements } from "./hoyoverse";
import { fetchKuroNews } from "./kuro";
import { addDays, compareVersion, guessNextVersion, maxVersion, MIN_VERSION_DAYS, UPDATE_HOUR, VERSION_DAYS } from "./util";
import { fetchWikiFacts } from "./wiki";

/** Spiele mit Countdown, in der Reihenfolge der Seite ohne Profil. */
export const VERSION_GAMES: GameId[] = ["genshin", "starrail", "zzz", "wuwa"];

/**
 * Offizielle Quelle je Spiel. ZZZ hat keine öffentliche Ankündigungs-Schnittstelle;
 * dort ist der Banner-Kalender von HoYoLAB (mit Konto) die offizielle Quelle, siehe `bannerFacts`.
 */
const OFFICIAL: Partial<Record<GameId, (signal?: AbortSignal) => Promise<VersionFacts>>> = {
  genshin: (s) => fetchHoyoAnnouncements("genshin", s),
  starrail: (s) => fetchHoyoAnnouncements("starrail", s),
  wuwa: (s) => fetchKuroNews(s),
};

const DEFAULT_HOUR: Record<GameId, number> = {
  genshin: UPDATE_HOUR.hoyoverse,
  starrail: UPDATE_HOUR.hoyoverse,
  zzz: UPDATE_HOUR.hoyoverse,
  wuwa: UPDATE_HOUR.kuro,
};

/** Ohne `current` ist eine Quelle wertlos, Fehler einzelner Quellen fallen weg. */
async function settle(p: Promise<VersionFacts> | undefined): Promise<VersionFacts | undefined> {
  try {
    const f = await p;
    return f?.current ? f : undefined;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return undefined;
  }
}

export interface FetchedFacts {
  official?: VersionFacts;
  wiki?: VersionFacts;
}

/** Offizielle Quelle und Wiki parallel; ein Fehler nur einer Quelle bleibt folgenlos. */
export async function fetchVersionFacts(game: GameId, signal?: AbortSignal): Promise<FetchedFacts> {
  const [official, wiki] = await Promise.all([settle(OFFICIAL[game]?.(signal)), settle(fetchWikiFacts(game, DEFAULT_HOUR[game], signal))]);
  if (!official && !wiki) throw new ApiError("network", "Keine Quelle für die Version erreichbar");
  return { official, wiki };
}

/** Rangfolge: offizielle Ankündigungen, dann der Bannerkalender von HoYoLAB, zuletzt das Wiki. */
export function rankFacts(fetched: FetchedFacts, banners?: VersionFacts): VersionFacts[] {
  return [fetched.official, banners, fetched.wiki].filter((f): f is VersionFacts => !!f);
}

/**
 * Aus dem Banner-Kalender von HoYoLAB (mit Konto): Version der laufenden Banner, das Ende ist das späteste
 * Bannerende dieser Version, eine schon angekündigte höhere Version die nächste.
 */
export function bannerFacts(banners: Banner[], now = new Date()): VersionFacts | undefined {
  const running = banners.filter((b) => b.version && b.start && b.start <= now && (!b.end || b.end > now));
  const current = maxVersion(running.map((b) => b.version!));
  if (!current) return undefined;
  // Auch schon angekündigte Banner der zweiten Phase zählen mit.
  const ends = banners.filter((b) => b.version === current && b.end).map((b) => b.end!.getTime());
  const later = banners.map((b) => b.version).filter((v): v is string => !!v && compareVersion(v, current) > 0);
  return {
    current,
    end: ends.length ? new Date(Math.max(...ends)) : undefined,
    next: maxVersion(later),
    source: { label: "HoYoLAB-Bannerkalender", url: "https://www.hoyolab.com" },
  };
}

/**
 * Führt die Quellen in ihrer Rangfolge zusammen. Maßgeblich ist die höchste aktuelle Version;
 * Angaben einer Quelle, die noch eine ältere Version für aktuell hält, werden nicht übernommen.
 * Fehlt das Ende, wird es aus Beginn plus üblicher Versionslänge geschätzt.
 */
export function mergeVersionFacts(game: GameId, ranked: VersionFacts[], now = new Date()): VersionInfo | undefined {
  const current = maxVersion(ranked.map((f) => f.current).filter((v): v is string => !!v));
  if (!current) return undefined;
  const same = ranked.filter((f) => f.current === current);
  const used = new Set<VersionFacts>();
  const pick = <K extends "start" | "end" | "next">(key: K, ok: (f: VersionFacts) => boolean = () => true): VersionFacts[K] => {
    const f = same.find((x) => x[key] !== undefined && ok(x));
    if (f) used.add(f);
    return f?.[key];
  };
  const start = pick("start");
  const next = pick("next");
  // Ein Ende kurz nach dem Beginn ist nur das Ende der ersten Bannerphase, kein Versionsende.
  let end = pick("end", (f) => f.end! > addDays(now, -1) && (!start || f.end! >= addDays(start, MIN_VERSION_DAYS)));
  const endEstimated = !end;
  if (!end) {
    // Ohne Beginn bleibt nur die Schätzung ab jetzt; die Anzeige kennzeichnet sie.
    end = addDays(start ?? now, VERSION_DAYS);
    while (end < now) end = addDays(end, VERSION_DAYS);
  }
  if (used.size === 0) used.add(same[0]);
  return {
    game,
    current,
    start,
    next: next ?? guessNextVersion(current),
    nextGuessed: !next,
    end,
    endEstimated,
    sources: same.filter((f) => used.has(f)).map((f) => f.source),
  };
}
