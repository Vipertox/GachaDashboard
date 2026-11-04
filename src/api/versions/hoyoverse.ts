import { z } from "zod";
import { httpJson } from "../http";
import { parseOrThrow } from "../adapters/util";
import type { VersionFacts } from "../../model/types";
import { compareVersion, firstVersion, maxVersion, parseZoned, versionsIn } from "./util";

/**
 * Ankündigungen im Spiel ("Neuigkeiten"), dieselbe Schnittstelle wie im Client.
 * Öffentlich und ohne Anmeldung; die UID ist ein Platzhalter, die Region legt die Zeitzone fest.
 */
const ENDPOINTS = {
  genshin: {
    url: "https://sg-hk4e-api.hoyoverse.com/common/hk4e_global/announcement/api/getAnnList",
    params: { game: "hk4e", game_biz: "hk4e_global", bundle_id: "hk4e_global", region: "os_asia", uid: "800000000", level: "60" },
    news: "https://genshin.hoyoverse.com/en/news",
  },
  starrail: {
    url: "https://sg-hkrpg-api.hoyoverse.com/common/hkrpg_global/announcement/api/getAnnList",
    params: { game: "hkrpg", game_biz: "hkrpg_global", bundle_id: "hkrpg_global", region: "prod_official_asia", uid: "800000000", level: "70" },
    news: "https://hsr.hoyoverse.com/en-us/news",
  },
} as const;

export type HoyoAnnGame = keyof typeof ENDPOINTS;

const ann = z.object({
  title: z.string(),
  subtitle: z.string().optional().nullable(),
  start_time: z.string(),
  end_time: z.string(),
});

const annListSchema = z.object({
  retcode: z.number(),
  data: z
    .object({
      timezone: z.number().optional(),
      list: z.array(z.object({ list: z.array(ann) })),
    })
    .nullable(),
});

const DAY = 86_400_000;

/**
 * Aktuelle Version aus der Ankündigung "Version X.Y … Update Details". Ihr Ende liegt kurz nach dem Wartungsbeginn,
 * daher gilt das früheste Ende aller Ankündigungen derselben Version am letzten Tag als Versionsende.
 * Eine höhere Version in einem Titel (z. B. "Version 4.7 Store Update") ist die nächste.
 */
export function parseHoyoAnnouncements(data: unknown, source: VersionFacts["source"], now = new Date()): VersionFacts {
  const d = parseOrThrow(annListSchema, data).data;
  const tz = d?.timezone ?? 8;
  const items = (d?.list ?? []).flatMap((t) => t.list).map((a) => ({
    text: `${a.title} ${a.subtitle ?? ""}`,
    start: parseZoned(a.start_time, tz),
    end: parseZoned(a.end_time, tz),
  }));

  const details = items
    .filter((a) => /update details/i.test(a.text) && a.start && a.start <= now)
    .map((a) => ({ ...a, version: firstVersion(a.text) }))
    .filter((a): a is typeof a & { version: string } => !!a.version)
    .sort((a, b) => compareVersion(b.version, a.version));
  const main = details[0];
  if (!main) return { source };

  const sameVersion = items.filter((a) => versionsIn(a.text).includes(main.version) && a.end);
  const lastDay = sameVersion
    .map((a) => a.end!)
    .filter((e) => main.end && e <= main.end && main.end.getTime() - e.getTime() < DAY);
  const end = lastDay.length ? new Date(Math.min(...lastDay.map((e) => e.getTime()))) : main.end;

  const later = items.flatMap((a) => versionsIn(a.text)).filter((v) => compareVersion(v, main.version) > 0);
  return { current: main.version, start: main.start, end, next: maxVersion(later), source };
}

export async function fetchHoyoAnnouncements(game: HoyoAnnGame, signal?: AbortSignal): Promise<VersionFacts> {
  const e = ENDPOINTS[game];
  const qs = new URLSearchParams({ ...e.params, lang: "en", platform: "pc" });
  const json = await httpJson({ url: `${e.url}?${qs}`, signal });
  return parseHoyoAnnouncements(json, { label: "HoYoverse-Ankündigungen", url: e.news });
}
