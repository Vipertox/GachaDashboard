import { pagesWithPrefix, pageContents, wikiUrl, WIKIS } from "../fandom";
import type { GameId, VersionFacts } from "../../model/types";
import { compareVersion, maxVersion, parseWikiDate } from "./util";

const VERSION_PAGE = /^Version\/(\d+\.\d+)$/;

/** Feld einer Infobox ohne Kommentare, z. B. `|next = <!--3.4-->` ergibt "". */
export function infoboxField(wikitext: string, ...names: string[]): string | undefined {
  for (const name of names) {
    const m = wikitext.match(new RegExp(`^\\|\\s*${name}\\s*=(.*)$`, "m"));
    const v = m?.[1].split("<!--")[0].trim();
    if (v) return v;
  }
  return undefined;
}

export interface WikiVersionPage {
  version: string;
  date?: Date;
  next?: string;
}

/**
 * Das Wiki nennt den Tag der Version, bei WuWa auch die Freigabe nach der Wartung ("2026-09-30 11:00").
 * Gezählt wird bis zum Wartungsbeginn, daher gilt nur der Tag mit `updateHour` (UTC+8).
 */
export function parseVersionPage(version: string, wikitext: string, updateHour: number): WikiVersionPage {
  const day = infoboxField(wikitext, "release_date", "date")?.replace(/\s+\d{1,2}:\d{2}.*$/, "");
  return {
    version,
    date: parseWikiDate(day, updateHour),
    next: infoboxField(wikitext, "next")?.match(/\d+\.\d+/)?.[0],
  };
}

/**
 * Aktuell ist die höchste Version, die schon begonnen hat. Die nächste ist die folgende Seite
 * oder der Eintrag `next` der Infobox; deren Datum ist das Ende der aktuellen.
 */
export function wikiFacts(pages: WikiVersionPage[], source: VersionFacts["source"], now = new Date()): VersionFacts {
  const sorted = [...pages].sort((a, b) => compareVersion(a.version, b.version));
  let idx = sorted.length - 1;
  while (idx >= 0 && !(sorted[idx].date && sorted[idx].date! <= now)) idx--;
  if (idx < 0) return { source };
  const current = sorted[idx];
  const upcoming = sorted[idx + 1];
  return {
    current: current.version,
    start: current.date,
    end: upcoming?.date,
    next: upcoming?.version ?? current.next,
    source,
  };
}

/** Liest die Versionsseiten `Version/X.Y` des Spiel-Wikis; nur die drei neuesten werden geladen. */
export async function fetchWikiFacts(game: GameId, defaultHour: number, signal?: AbortSignal): Promise<VersionFacts> {
  const wiki = WIKIS[game];
  const versions = (await pagesWithPrefix("Version/", signal, wiki))
    .map((t) => t.match(VERSION_PAGE)?.[1])
    .filter((v): v is string => !!v)
    .sort(compareVersion)
    .slice(-3);
  const contents = await pageContents(versions.map((v) => `Version/${v}`), signal, wiki);
  const pages = versions.map((v) => parseVersionPage(v, contents.get(`Version/${v}`) ?? "", defaultHour));
  const latest = maxVersion(versions);
  return wikiFacts(pages, { label: "Fandom-Wiki (CC BY-SA)", url: wikiUrl(`Version/${latest ?? ""}`, wiki) });
}

