import { genshinEvents } from "./genshin";
import { starrailEvents } from "./starrail";
import { zzzEvents } from "./zzz";
import type { EventAdapter, GameId } from "../../model/types";

/** Wuthering Waves fehlt: Die Launcher-API liefert keine Events. */
export const EVENT_ADAPTERS: Partial<Record<GameId, EventAdapter>> = {
  genshin: genshinEvents,
  starrail: starrailEvents,
  zzz: zzzEvents,
};
