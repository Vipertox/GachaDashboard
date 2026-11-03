import { genshinEvents } from "./genshin";
import { starrailEvents } from "./starrail";
import { wuwaEvents } from "./wuwa";
import { zzzEvents } from "./zzz";
import type { EventAdapter, GameId } from "../../model/types";

/** Wuthering Waves: nur Banner aus dem Wiki, Events liefert keine Quelle. */
export const EVENT_ADAPTERS: Partial<Record<GameId, EventAdapter>> = {
  genshin: genshinEvents,
  starrail: starrailEvents,
  zzz: zzzEvents,
  wuwa: wuwaEvents,
};
