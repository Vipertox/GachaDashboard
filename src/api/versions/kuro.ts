import { z } from "zod";
import { httpJson } from "../http";
import { parseOrThrow } from "../adapters/util";
import type { VersionFacts } from "../../model/types";
import { compareVersion, firstVersion, maxVersion, parseWikiDate, parseZoned, SERVER_TZ, UPDATE_HOUR, versionsIn } from "./util";

/** Nachrichten der offiziellen Website, als JSON auf dem CDN von Kuro Games. Zeiten in UTC+8. */
const BASE = "https://hw-media-cdn-mingchao.kurogame.com/akiwebsite/website2.0/json/G152/en";
const NEWS = "https://wutheringwaves.kurogames.com/en/main/news/";

const menuSchema = z.array(z.object({ articleId: z.number(), articleTitle: z.string(), startTime: z.string() }));
const articleSchema = z.object({ articleContent: z.string().optional().nullable() });

export type KuroArticle = z.infer<typeof menuSchema>[number];

export interface KuroPlan {
  facts: VersionFacts;
  /** Artikel zu Phase II der Banner; dessen Ende ist das Versionsende. */
  phaseTwoId?: number;
}

const PATCH_NOTES = /patch notes/i;
const PHASE_TWO = /convene:\s*phase\s*(?:Ⅱ|II|2)(?![\wⅠⅡⅢ])/i;
const RELEASE_ON = /[Rr]eleased? on ([A-Z][a-z]+ \d{1,2})(?:st|nd|rd|th)?/;

/**
 * Aktuelle Version aus den neuesten Patch Notes, die nächste aus jedem jüngeren Titel mit höherer Nummer.
 * Nennt dessen Vorschau ein Datum ("Scheduled for Release on November 12th (UTC+8)"), ist das der Beginn.
 */
export function planKuro(data: unknown, now = new Date()): KuroPlan {
  const source = { label: "Kuro Games News", url: NEWS };
  const list = parseOrThrow(menuSchema, data).map((a) => ({ ...a, start: parseZoned(a.startTime, SERVER_TZ) }));
  const notes = list
    .filter((a) => PATCH_NOTES.test(a.articleTitle) && a.start && a.start <= now)
    .map((a) => ({ ...a, version: firstVersion(a.articleTitle) }))
    .filter((a): a is typeof a & { version: string } => !!a.version)
    .sort((a, b) => compareVersion(b.version, a.version));
  const current = notes[0];
  if (!current) return { facts: { source } };

  const later = list.filter((a) => versionsIn(a.articleTitle).some((v) => compareVersion(v, current.version) > 0));
  const next = maxVersion(later.flatMap((a) => versionsIn(a.articleTitle)).filter((v) => compareVersion(v, current.version) > 0));
  const preview = later.find((a) => next && versionsIn(a.articleTitle).includes(next) && RELEASE_ON.test(a.articleTitle));
  const releaseDay = preview?.articleTitle.match(RELEASE_ON)?.[1];
  // Der Titel nennt kein Jahr: es ist das der Vorschau, beim Jahreswechsel das folgende.
  const year = preview?.start?.getUTCFullYear();
  let end = releaseDay && year ? parseWikiDate(`${releaseDay}, ${year}`, UPDATE_HOUR.kuro) : undefined;
  if (end && year && preview?.start && end < preview.start) end = parseWikiDate(`${releaseDay}, ${year + 1}`, UPDATE_HOUR.kuro);

  const phaseTwo = list.find((a) => PHASE_TWO.test(a.articleTitle) && firstVersion(a.articleTitle) === current.version);
  return {
    facts: { current: current.version, start: current.start, end, next, source },
    phaseTwoId: phaseTwo?.articleId,
  };
}

/** "✦Duration✦ 2026-10-22 10:00 - 2026-11-11 11:59 (server time)": das zweite Datum ist das Ende. */
export function parsePhaseEnd(html: string): Date | undefined {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  const m = text.match(/\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}\s*[-–~]\s*(\d{4}-\d{2}-\d{2} \d{1,2}:\d{2})/);
  return m ? parseZoned(m[1], SERVER_TZ) : undefined;
}

export async function fetchKuroNews(signal?: AbortSignal): Promise<VersionFacts> {
  const plan = planKuro(await httpJson({ url: `${BASE}/ArticleMenu.json`, signal }));
  if (plan.facts.end || !plan.phaseTwoId) return plan.facts;
  const article = parseOrThrow(articleSchema, await httpJson({ url: `${BASE}/article/${plan.phaseTwoId}.json`, signal }));
  return { ...plan.facts, end: parsePhaseEnd(article.articleContent ?? "") };
}
