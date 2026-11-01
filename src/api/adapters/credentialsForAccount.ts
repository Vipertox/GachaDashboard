import { ApiError } from "../errors";
import type { HoyoCredentials } from "../hoyolab";
import type { Account } from "../../model/types";

/** Gibt die HoYoLAB-Zugangsdaten des Kontos weiter oder meldet, dass sie fehlen. */
export async function fetchWithCredentials<T>(
  account: Account,
  run: (creds: HoyoCredentials) => Promise<T>,
): Promise<T> {
  if (!account.ltuid || !account.ltoken) {
    throw new ApiError("missing_credentials", "HoYoLAB-Tokens fehlen");
  }
  return run({ ltuid: account.ltuid, ltoken: account.ltoken });
}
