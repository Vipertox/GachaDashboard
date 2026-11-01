import type { GameId, GameMeta } from "./types";

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
