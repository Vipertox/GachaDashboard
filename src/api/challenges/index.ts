import { genshinChallenges } from "./genshin";
import { starrailChallenges } from "./starrail";
import { zzzChallenges } from "./zzz";
import type { ChallengeMode, GameId } from "../../model/types";

/** Wuthering Waves fehlt: Die Launcher-API liefert nichts zu Tower of Adversity oder Whimpering Wastes. */
export const CHALLENGE_MODES: Partial<Record<GameId, ChallengeMode[]>> = {
  genshin: genshinChallenges,
  starrail: starrailChallenges,
  zzz: zzzChallenges,
};
