import type { GameId, GameMeta, GameTerms } from "./types";

export const GAME_META: Record<GameId, GameMeta> = {
  genshin: {
    game: "genshin",
    name: "Genshin Impact",
    iconKey: "games/genshin",
    artworkKey: "artwork/genshin",
    accentColor: "genshin-500",
  },
  starrail: {
    game: "starrail",
    name: "Honkai: Star Rail",
    iconKey: "games/starrail",
    artworkKey: "artwork/starrail",
    accentColor: "starrail-500",
  },
  zzz: {
    game: "zzz",
    name: "Zenless Zone Zero",
    iconKey: "games/zzz",
    artworkKey: "artwork/zzz",
    accentColor: "zzz-500",
  },
  wuwa: {
    game: "wuwa",
    name: "Wuthering Waves",
    iconKey: "games/wuwa",
    artworkKey: "artwork/wuwa",
    accentColor: "wuwa-500",
  },
};

/** Hex-Werte passend zu den Tailwind-Tokens in index.css, fuer Inline-Styles. */
export const GAME_ACCENT: Record<GameId, string> = {
  genshin: "#e8b04a",
  starrail: "#9a8cff",
  zzz: "#f2d53c",
  wuwa: "#4fd1c5",
};

/** Begriffe pro Spiel, siehe docs/Konzept.md, Abschnitt "Figurenübersicht". Das Datenmodell ist für alle Spiele gleich. */
export const GAME_TERMS: Record<GameId, GameTerms> = {
  genshin: {
    character: "Charakter",
    characters: "Charaktere",
    dupePrefix: "C",
    weapon: "Waffe",
    refinePrefix: "R",
    gear: "Artefakte",
    skills: "Talente",
    slots: ["Blume", "Feder", "Sanduhr", "Kelch", "Krone"],
    elements: {
      pyro: { label: "Pyro", color: "#ef7a35" },
      hydro: { label: "Hydro", color: "#4cc2f1" },
      anemo: { label: "Anemo", color: "#74c2a8" },
      electro: { label: "Electro", color: "#af8ee6" },
      dendro: { label: "Dendro", color: "#a5c83b" },
      cryo: { label: "Cryo", color: "#9fd6e3" },
      geo: { label: "Geo", color: "#f0b232" },
    },
  },
  starrail: {
    character: "Charakter",
    characters: "Charaktere",
    dupePrefix: "E",
    weapon: "Lichtkegel",
    refinePrefix: "S",
    gear: "Relikte und Ornamente",
    skills: "Fähigkeiten",
    slots: ["Kopf", "Hände", "Körper", "Füße", "Planarsphäre", "Verbindungsseil"],
    elements: {
      physical: { label: "Physisch", color: "#c9c9c9" },
      fire: { label: "Feuer", color: "#f0613a" },
      ice: { label: "Eis", color: "#5fc6f0" },
      lightning: { label: "Blitz", color: "#c67bf0" },
      wind: { label: "Wind", color: "#5dd8a3" },
      quantum: { label: "Quanten", color: "#7a6cf0" },
      imaginary: { label: "Imaginär", color: "#f2d34d" },
    },
    roleLabel: "Pfad",
    roles: {
      "1": "Zerstörung",
      "2": "Jagd",
      "3": "Gelehrsamkeit",
      "4": "Harmonie",
      "5": "Nichts",
      "6": "Bewahrung",
      "7": "Überfluss",
      "8": "Erinnerung",
    },
  },
  zzz: {
    character: "Agent",
    characters: "Agenten",
    dupePrefix: "M",
    weapon: "W-Engine",
    refinePrefix: "R",
    gear: "Drive Discs",
    skills: "Fertigkeiten",
    slots: ["Disc 1", "Disc 2", "Disc 3", "Disc 4", "Disc 5", "Disc 6"],
    elements: {
      physical: { label: "Physisch", color: "#e6b33e" },
      fire: { label: "Feuer", color: "#f0613a" },
      ice: { label: "Eis", color: "#5fc6f0", short: "Ei" },
      electric: { label: "Elektrisch", color: "#4f8ff0", short: "El" },
      ether: { label: "Äther", color: "#e04fb5" },
    },
    roleLabel: "Rolle",
    roles: {
      "1": "Angriff",
      "2": "Betäubung",
      "3": "Anomalie",
      "4": "Unterstützung",
      "5": "Verteidigung",
      "6": "Durchbruch",
    },
  },
  wuwa: {
    character: "Resonator",
    characters: "Resonatoren",
    dupePrefix: "S",
    weapon: "Waffe",
    refinePrefix: "R",
    gear: "Echos",
    skills: "Fertigkeiten",
    slots: ["Echo 1", "Echo 2", "Echo 3", "Echo 4", "Echo 5"],
    elements: {},
  },
};

/** Farben der Seltenheiten für Kachelhintergründe. */
export const RARITY_COLOR: Record<number, string> = {
  5: "#b98a3e",
  4: "#7e62b8",
  3: "#4b7cb3",
};
