import { useQueries, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { ADAPTERS } from "../api/adapters";
import { ApiError } from "../api/errors";
import { loadSecrets } from "../credentials";
import type { GameAccountRef, GameStatus, Profile } from "../model/types";
import { useApp } from "./state";

// Ein gemeinsamer Sekundentakt für alle Countdowns.
let tick = Date.now();
const listeners = new Set<() => void>();
let timerId: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timerId) {
    timerId = setInterval(() => {
      tick = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timerId) {
      clearInterval(timerId);
      timerId = undefined;
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, () => tick);
}

export function statusKey(profileId: string, ref: GameAccountRef) {
  return ["status", profileId, ref.game, ref.uid] as const;
}

function useStatusOptions() {
  const qc = useQueryClient();
  const { settings } = useApp();
  return (profile: Profile, ref: GameAccountRef): UseQueryOptions<GameStatus, ApiError> => ({
    queryKey: statusKey(profile.id, ref),
    queryFn: async ({ signal }) => {
      const secrets = await qc.ensureQueryData({
        queryKey: ["secrets", profile.id],
        queryFn: () => loadSecrets(profile.id),
        staleTime: Infinity,
      });
      return ADAPTERS[ref.game].fetchStatus(
        {
          profileId: profile.id,
          game: ref.game,
          uid: ref.uid,
          region: ref.region,
          nickname: ref.nickname,
          ltuid: secrets.ltuid || undefined,
          ltoken: secrets.ltoken || undefined,
          oauthCode: secrets.kuroOauth || undefined,
        },
        signal,
      );
    },
    staleTime: 60_000,
    refetchInterval: settings.refreshMinutes * 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: (count: number, err: ApiError) =>
      count < 1 && (err.kind === "network" || err.kind === "unknown"),
  });
}

export function useGameStatus(profile: Profile, ref: GameAccountRef) {
  const options = useStatusOptions();
  return useQuery<GameStatus, ApiError>(options(profile, ref));
}

export function useGameStatuses(profile: Profile, refs: GameAccountRef[]) {
  const options = useStatusOptions();
  return useQueries({ queries: refs.map((r) => options(profile, r)) });
}

/** Sichtbare Spielkonten eines Profils in der gewählten Reihenfolge. */
export function visibleGames(profile: Profile): GameAccountRef[] {
  return profile.games.filter((g) => g.visible).sort((a, b) => a.order - b.order);
}
