import { z } from "zod";
import { ApiError } from "./errors";
import { httpJson } from "./http";
import { parseOrThrow } from "./adapters/util";

/** MediaWiki-API des Wuthering Waves Wiki auf Fandom. Öffentlich, ohne Anmeldung, Inhalte unter CC BY-SA. */
export const WIKI = "https://wutheringwaves.fandom.com";
const API = `${WIKI}/api.php`;

/** Wikis verlangen einen eigenen User-Agent, damit sich Zugriffe zuordnen lassen. */
const USER_AGENT = "GachaDashboard (https://github.com/Vipertox/GachaDashboard)";

const RATE_LIMIT_CODES = new Set(["ratelimited", "maxlag"]);

const errorSchema = z.object({ error: z.object({ code: z.string(), info: z.string().optional() }).optional() });

async function query(params: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const qs = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params });
  const json = await httpJson({ url: `${API}?${qs}`, headers: { "user-agent": USER_AGENT }, signal });
  const err = errorSchema.safeParse(json);
  if (err.success && err.data.error) {
    // MediaWiki meldet Drosselung mit eigenen Codes; die Anzeige rät dann zum späteren Versuch.
    const kind = RATE_LIMIT_CODES.has(err.data.error.code) ? "rate_limit" : "unknown";
    throw new ApiError(kind, `Wiki: ${err.data.error.info ?? err.data.error.code}`);
  }
  return json;
}

/** Link auf eine Wiki-Seite; der Schrägstrich der Unterseiten bleibt erhalten. */
export function wikiUrl(title: string): string {
  return `${WIKI}/wiki/${title.replace(/ /g, "_").split("/").map(encodeURIComponent).join("/")}`;
}

const membersSchema = z.object({
  query: z.object({ categorymembers: z.array(z.object({ title: z.string() })) }),
});

/** Zuletzt in die Kategorie aufgenommene Seiten, die neuesten zuerst. */
export async function recentCategoryMembers(category: string, limit: number, signal?: AbortSignal): Promise<string[]> {
  const json = await query(
    { list: "categorymembers", cmtitle: `Category:${category}`, cmsort: "timestamp", cmdir: "desc", cmlimit: String(limit), cmnamespace: "0" },
    signal,
  );
  return parseOrThrow(membersSchema, json).query.categorymembers.map((m) => m.title);
}

const contentSchema = z.object({
  query: z.object({
    pages: z.array(
      z.object({
        title: z.string(),
        missing: z.boolean().optional(),
        revisions: z
          .array(z.object({ slots: z.object({ main: z.object({ content: z.string().optional() }) }) }))
          .optional(),
      }),
    ),
  }),
});

/** Wikitext mehrerer Seiten in einem Aufruf (höchstens 50 Titel). */
export async function pageContents(titles: string[], signal?: AbortSignal): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (titles.length === 0) return out;
  const json = await query(
    { prop: "revisions", rvprop: "content", rvslots: "main", titles: titles.slice(0, 50).join("|") },
    signal,
  );
  for (const p of parseOrThrow(contentSchema, json).query.pages) {
    const text = p.revisions?.[0]?.slots.main.content;
    if (!p.missing && text) out.set(p.title, text);
  }
  return out;
}

const imageSchema = z.object({
  query: z.object({
    normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
    pages: z.array(
      z.object({
        title: z.string(),
        imageinfo: z.array(z.object({ thumburl: z.string().optional(), url: z.string().optional() })).optional(),
      }),
    ),
  }),
});

/** Bild-URLs zu Dateinamen ohne "File:", verkleinert auf `width` Pixel. Fehlende Dateien fehlen in der Map. */
export async function imageUrls(files: string[], width: number, signal?: AbortSignal): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(files)].slice(0, 50);
  if (unique.length === 0) return out;
  const json = await query(
    { prop: "imageinfo", iiprop: "url", iiurlwidth: String(width), titles: unique.map((f) => `File:${f}`).join("|") },
    signal,
  );
  const d = parseOrThrow(imageSchema, json).query;
  // Die API normalisiert Titel (z. B. Unterstriche); zurück auf den angefragten Namen abbilden.
  const asked = new Map((d.normalized ?? []).map((n) => [n.to, n.from]));
  for (const p of d.pages) {
    const url = p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url;
    if (url) out.set((asked.get(p.title) ?? p.title).replace(/^File:/, ""), url);
  }
  return out;
}
