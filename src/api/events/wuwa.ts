import { imageUrls, pageContents, recentCategoryMembers, WIKI, wikiUrl } from "../fandom";
import { bannerStatus, isCurrent } from "./util";
import type { Banner, BannerItem, BannerKind, EventAdapter } from "../../model/types";

/**
 * Banner kommen aus dem Wuthering Waves Wiki, die Kuro-Schnittstelle liefert keine.
 * Jeder Banner hat dort eine Unterseite "<Name>/<Startdatum>" mit den Vorlagen {{Convene}} und {{Convene/Pool}}.
 */

/** So viele der zuletzt angelegten Banner-Seiten werden gelesen; eine Version hat bis zu 6 je Phase. */
const RECENT = 20;
const SUBPAGE = /\/\d{4}-\d{2}-\d{2}$/;

/**
 * Feste UTC-Abweichung des Servers in Stunden. Das Wiki nennt Zeiten in Serverzeit,
 * die Server kennen keine Sommerzeit. Unbekannte Server (Asia, HMT, SEA, TW/HK/MO) liegen auf UTC+8.
 */
export function wuwaOffset(region: string): number {
  if (/america/i.test(region)) return -5;
  if (/europe/i.test(region)) return 1;
  return 8;
}

/** Parameter einer Vorlage als Schlüssel/Wert; verschachtelte Vorlagen und Links bleiben unangetastet. */
export function templateParams(text: string, name: string): Record<string, string> | undefined {
  const start = text.search(new RegExp(`\\{\\{\\s*${name.replace(/[/]/g, "\\/")}\\s*[|\\n}]`));
  if (start < 0) return undefined;
  let depth = 0;
  let end = start;
  for (; end < text.length - 1; end++) {
    const two = text.slice(end, end + 2);
    if (two === "{{" || two === "[[") depth++;
    else if (two === "}}" || two === "]]") depth--;
    else continue;
    end++;
    if (depth === 0) break;
  }
  const body = text.slice(start + 2, end - 1);
  // An "|" auf oberster Ebene trennen, nicht innerhalb von {{…}} oder [[…]].
  const parts: string[] = [];
  let level = 0;
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") level++;
    if (two === "}}" || two === "]]") level--;
    if (body[i] === "|" && level === 0) {
      parts.push(cur);
      cur = "";
    } else cur += body[i];
  }
  parts.push(cur);
  const out: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) out[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
  }
  return out;
}

/** "2026-10-22 10:00" in Serverzeit; ein Wert wie "UTC+8" in `*_offset` gilt vor dem Server des Kontos. */
export function wikiDate(value: string | undefined, offset: string | undefined, region: string): Date | undefined {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return undefined;
  const fixed = offset?.match(/^UTC\s*([+-]\d{1,2})/i);
  const hours = fixed ? Number(fixed[1]) : wuwaOffset(region);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], (m[4] ? +m[4] : 0) - hours, m[5] ? +m[5] : 0));
}

function bannerKind(type: string | undefined): BannerKind {
  if (/resonator/i.test(type ?? "")) return "character";
  if (/weapon/i.test(type ?? "")) return "weapon";
  return "other";
}

const names = (v: string | undefined) =>
  (v ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

/** Dateiname des Symbols im Wiki, z. B. "Resonator Lucilla.png" oder "Weapon Freeze Frame.png". */
export const iconFile = (item: { name: string }, weapon: boolean) => `${weapon ? "Weapon" : "Resonator"} ${item.name}.png`;

interface ParsedItem extends BannerItem {
  weapon: boolean;
}

type WikiBanner = Omit<Banner, "items"> & { items: ParsedItem[] };

/** Ein Banner aus dem Wikitext seiner Seite; Seiten ohne Ende (Dauerbanner) entfallen. */
export function parseWikiBanner(
  title: string,
  text: string,
  region: string,
  now = new Date(),
): WikiBanner | undefined {
  const c = templateParams(text, "Convene");
  if (!c) return undefined;
  const start = wikiDate(c.time_start, c.time_start_offset, region);
  const end = wikiDate(c.time_end, c.time_end_offset || c.time_start_offset, region);
  if (!end) return undefined;
  const pool = templateParams(text, "Convene/Pool") ?? {};
  const items: ParsedItem[] = [
    ...names(pool.resonator_5_F).map((name) => ({ name, rarity: 5, weapon: false })),
    ...names(pool.weapon_5_F).map((name) => ({ name, rarity: 5, weapon: true })),
    ...names(pool.resonator_4_F).map((name) => ({ name, rarity: 4, weapon: false })),
    ...names(pool.weapon_4_F).map((name) => ({ name, rarity: 4, weapon: true })),
  ];
  return {
    id: title,
    name: title.replace(SUBPAGE, ""),
    kind: bannerKind(c.type),
    version: text.match(/\{\{\s*Change History\s*\|\s*(\d+\.\d+)/)?.[1],
    start,
    end,
    status: bannerStatus(start, now),
    items,
    sourceUrl: wikiUrl(title),
  };
}

/** Laufende und kommende Banner: neueste Seiten der Kategorie lesen, dann die Symbole der Figuren und Waffen. */
export async function fetchWikiBanners(region: string, signal?: AbortSignal, now = new Date()): Promise<Banner[]> {
  const titles = (await recentCategoryMembers("Convene", RECENT, signal)).filter((t) => SUBPAGE.test(t));
  const texts = await pageContents(titles, signal);
  const banners = titles.flatMap((t): WikiBanner[] => {
    const text = texts.get(t);
    const b = text ? parseWikiBanner(t, text, region, now) : undefined;
    return b && isCurrent(b, now) ? [b] : [];
  });
  // Symbole sind Beiwerk: Fehlt das Bild oder scheitert der Aufruf, bleibt der Chip ohne Bild.
  const files = banners.flatMap((b) => b.items.map((i) => iconFile(i, i.weapon)));
  const icons = await imageUrls(files, 96, signal).catch(() => new Map<string, string>());
  return banners.map((b) => ({
    ...b,
    items: b.items.map(({ weapon, ...i }) => ({ ...i, iconUrl: icons.get(iconFile(i, weapon)) })),
  }));
}

export const wuwaEvents: EventAdapter = {
  game: "wuwa",
  bannersOnly: true,
  source: { label: "Wuthering Waves Wiki (Fandom), CC BY-SA", url: WIKI },
  fetchCalendar: async (account, signal) => ({ events: [], banners: await fetchWikiBanners(account.region, signal) }),
};
