import type { CharacterSummary, GameId } from "../../model/types";

/**
 * Link zur Prydwen-Seite einer Figur, siehe docs/Konzept.md, Abschnitt "Build-Guide auf Prydwen".
 * Prydwen hat keine API und keinen Link direkt auf den Tab "Build and teams", deshalb nur die Charakterseite.
 */
const SECTION: Partial<Record<GameId, string>> = {
  genshin: "genshin-impact",
  starrail: "star-rail",
  zzz: "zenless",
};

/**
 * HoYoLAB liefert die Namen auf Deutsch, Prydwen nutzt englische Slugs.
 * Schlüssel ist der Slug des deutschen Namens, damit Schreibvarianten wie "•" und "-" egal sind.
 * Abgeglichen mit dem HoYoWiki (de-de/en-us) und der Prydwen-Sitemap, Stand 2026-11.
 */
const SLUG_EXCEPTIONS: Partial<Record<GameId, Record<string, string>>> = {
  genshin: {
    "shougun-raiden": "raiden-shogun",
    saccharose: "sucrose",
  },
  starrail: {
    "7-marz": "march-7th",
    "7-marz-die-jagd": "march-7th-swordmaster",
    evernight: "march-7th-evernight",
    "aonin-aha": "aha",
    aventurin: "aventurine",
    "aventurin-wellenflair": "aventurine-waveflair",
    "dan-heng-imbibitor-lunae": "imbibitor-lunae",
    "die-dahlie": "the-dahlia",
    "dr-wahrheit": "dr-ratio",
    fugue: "tingyun-fugue",
    gluhwurmchen: "firefly",
    "grosse-herta": "the-herta",
    "mortenax-blade": "blade-mortenax",
    "schwarzer-schwan": "black-swan",
    silberwolf: "silver-wolf",
    "silberwolf-st-999": "silver-wolf-lv-999",
    sonntag: "sunday",
    "topaz-und-kontie": "topaz",
  },
  // HoYoLAB liefert bei ZZZ Kurznamen (`name_mi18n`), Prydwen nutzt bei einigen Agenten den vollen Namen.
  zzz: {
    anby: "anby-demara",
    billy: "billy-kid",
    grace: "grace-howard",
    jane: "jane-doe",
    nicole: "nicole-demara",
    yuzuha: "ukinami-yuzuha",
    "orphie-magnusson-magus": "orphie-and-magus",
    "orphie-magus": "orphie-and-magus",
    "soldatin-0-anby": "anby-demara-soldier-0",
    "soldatin-nr-0-anby": "anby-demara-soldier-0",
    "soldatin-11": "soldier-11",
    "soldatin-nr-11": "soldier-11",
    "sternenlicht-billy": "billy-starlight",
  },
};

/** Reisender (Aether, Lumine): eine Prydwen-Seite pro Element. */
const GENSHIN_TRAVELER = new Set(["10000005", "10000007"]);

/** Trailblazer: je Pfad zwei IDs (männlich, weiblich). */
const TRAILBLAZER_PATH: Record<string, string> = {
  "8001": "destruction",
  "8002": "destruction",
  "8003": "preservation",
  "8004": "preservation",
  "8005": "harmony",
  "8006": "harmony",
  "8007": "remembrance",
  "8008": "remembrance",
  "8009": "elation",
  "8010": "elation",
};

export function slugify(name: string): string {
  return name
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function prydwenSlug(game: GameId, c: CharacterSummary): string | undefined {
  if (game === "genshin" && GENSHIN_TRAVELER.has(c.id)) return c.element ? `traveler-${c.element}` : undefined;
  if (game === "starrail" && TRAILBLAZER_PATH[c.id]) return `trailblazer-${TRAILBLAZER_PATH[c.id]}`;
  const slug = slugify(c.name);
  return SLUG_EXCEPTIONS[game]?.[slug] ?? (slug || undefined);
}

/** URL der Prydwen-Charakterseite oder `undefined`, wenn Prydwen das Spiel nicht abdeckt. */
export function prydwenUrl(game: GameId, c: CharacterSummary): string | undefined {
  const section = SECTION[game];
  const slug = section && prydwenSlug(game, c);
  return slug ? `https://www.prydwen.gg/${section}/characters/${slug}` : undefined;
}
