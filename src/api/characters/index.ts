import { genshinCharacters } from "./genshin";
import { starrailCharacters } from "./starrail";
import { zzzCharacters } from "./zzz";
import type { CharacterAdapter, GameId } from "../../model/types";

/** Wuthering Waves fehlt: Die Launcher-API liefert nur die Anzahl der Resonatoren. */
export const CHARACTER_ADAPTERS: Partial<Record<GameId, CharacterAdapter>> = {
  genshin: genshinCharacters,
  starrail: starrailCharacters,
  zzz: zzzCharacters,
};

/** Details werden in Blöcken nachgeladen, um die Rate-Limits zu schonen. */
export const DETAIL_CHUNK = 10;
