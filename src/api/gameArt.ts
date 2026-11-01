import { z } from "zod";
import { optNum } from "./adapters/util";
import { optStr } from "./characters/util";
import { hoyoGet, type HoyoCredentials } from "./hoyolab";
import type { GameId } from "../model/types";

/** Spiel-Icon und Kopfbild aus den HoYoLAB-Spielkarten; Wuthering Waves kommt dort nicht vor. */
export interface GameArt {
  iconUrl?: string;
  artworkUrl?: string;
}

// `game_id` der Spielkarten, wie in genshin.py (RecordCard).
const GAME_IDS: Record<number, GameId> = { 2: "genshin", 6: "starrail", 8: "zzz" };

const schema = z.object({
  list: z
    .array(z.object({ game_id: optNum, logo: optStr, background_image: optStr }))
    .optional()
    .nullable(),
});

export function parseGameArt(data: unknown): Partial<Record<GameId, GameArt>> {
  const parsed = schema.safeParse(data);
  const out: Partial<Record<GameId, GameArt>> = {};
  if (!parsed.success) return out;
  for (const card of parsed.data.list ?? []) {
    const game = GAME_IDS[card.game_id ?? 0];
    if (game && !out[game]) {
      out[game] = { iconUrl: card.logo || undefined, artworkUrl: card.background_image || undefined };
    }
  }
  return out;
}

/** Ein Aufruf pro HoYoLAB-Konto liefert die Karten aller verknüpften Spiele. */
export async function fetchGameArt(
  creds: HoyoCredentials,
  signal?: AbortSignal,
): Promise<Partial<Record<GameId, GameArt>>> {
  const data = await hoyoGet(
    `https://bbs-api-os.hoyolab.com/game_record/card/wapi/getGameRecordCard?uid=${creds.ltuid}`,
    creds,
    signal,
  );
  return parseGameArt(data);
}
