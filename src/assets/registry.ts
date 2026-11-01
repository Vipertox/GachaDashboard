/**
 * Ordnet Bildschlüssel ("games/genshin", "genshin/resin", "artwork/genshin") ihrer Datei zu.
 * Die Bilder liegen als <schluessel>.webp in diesem Ordner und sind nicht Teil des Repos
 * (Original-Material der Spiele, nur für den privaten Gebrauch). Fehlt eine Datei,
 * zeigt die Oberfläche ein neutrales Ersatzsymbol, siehe components/GameIcon.tsx.
 */
const files = import.meta.glob("./**/*.{webp,png,jpg,svg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const byKey: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  byKey[path.replace(/^\.\//, "").replace(/\.[a-z]+$/, "")] = url;
}

export function imageFor(key: string): string | undefined {
  return byKey[key];
}
