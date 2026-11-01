import { genshinAdapter } from "./genshin";
import { starrailAdapter } from "./starrail";
import { wuwaAdapter } from "./wuwa";
import { zzzAdapter } from "./zzz";
import type { GameAdapter, GameId } from "../../model/types";

export const ADAPTERS: Record<GameId, GameAdapter> = {
  genshin: genshinAdapter,
  starrail: starrailAdapter,
  zzz: zzzAdapter,
  wuwa: wuwaAdapter,
};
