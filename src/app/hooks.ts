import { QueryClient, useQueries, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { ADAPTERS } from "../api/adapters";
import { CHARACTER_ADAPTERS, DETAIL_CHUNK } from "../api/characters";
import { chunk } from "../api/characters/util";
import { ApiError } from "../api/errors";
import { loadSecrets } from "../credentials";
import type {
  Account,
  Challenge,
  ChallengeMode,
  ChallengePeriod,
  Character,
  GameAccountRef,
  GameStatus,
  Profile,
  Roster,
} from "../model/types";
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

export function statusKey(profileId: string, ref: Pick<GameAccountRef, "game" | "uid">) {
  return ["status", profileId, ref.game, ref.uid] as const;
}

/** Fehler aus Schlüsselspeicher oder Plugins haben keine `kind`; die Karten brauchen eine. */
function asApiError(e: unknown): unknown {
  if (e instanceof ApiError) return e;
  if (e instanceof DOMException && e.name === "AbortError") return e;
  return new ApiError("unknown", e instanceof Error ? e.message : String(e));
}

/** Zugangsdaten aus dem sicheren Speicher, einmal pro Profil gelesen. */
async function loadAccount(qc: QueryClient, profile: Profile, ref: GameAccountRef): Promise<Account> {
  const secrets = await qc.ensureQueryData({
    queryKey: ["secrets", profile.id],
    queryFn: () => loadSecrets(profile.id),
    staleTime: Infinity,
  });
  return {
    profileId: profile.id,
    game: ref.game,
    uid: ref.uid,
    region: ref.region,
    nickname: ref.nickname,
    ltuid: secrets.ltuid || undefined,
    ltoken: secrets.ltoken || undefined,
    oauthCode: secrets.kuroOauth || undefined,
  };
}

function useStatusOptions() {
  const qc = useQueryClient();
  const { settings } = useApp();
  return (profile: Profile, ref: GameAccountRef): UseQueryOptions<GameStatus, ApiError> => ({
    queryKey: statusKey(profile.id, ref),
    queryFn: async ({ signal }) => {
      try {
        return await ADAPTERS[ref.game].fetchStatus(await loadAccount(qc, profile, ref), signal);
      } catch (e) {
        throw asApiError(e);
      }
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

// Figurendaten ändern sich selten: kein Intervall, 30 Minuten frisch, Laden erst im Figuren-Tab.
const CHARACTER_STALE = 30 * 60_000;

export function rosterKey(profileId: string, ref: Pick<GameAccountRef, "game" | "uid">) {
  return ["roster", profileId, ref.game, ref.uid] as const;
}

export function useRoster(profile: Profile, ref: GameAccountRef) {
  const qc = useQueryClient();
  const adapter = CHARACTER_ADAPTERS[ref.game];
  return useQuery<Roster, ApiError>({
    queryKey: rosterKey(profile.id, ref),
    queryFn: async ({ signal }) => {
      try {
        return await adapter!.fetchRoster(await loadAccount(qc, profile, ref), signal);
      } catch (e) {
        throw asApiError(e);
      }
    },
    enabled: !!adapter,
    staleTime: CHARACTER_STALE,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export interface CharacterDetails {
  byId: Record<string, Character>;
  /** Abbruch nach einem Fehler, z. B. Rate-Limit; bereits geladene Details bleiben. */
  error?: ApiError;
}

/** Lädt die Details aller Figuren der Liste in Blöcken nach. */
export function useCharacterDetails(profile: Profile, ref: GameAccountRef, roster: Roster | undefined) {
  const qc = useQueryClient();
  const adapter = CHARACTER_ADAPTERS[ref.game];
  const ids = roster?.characters.map((c) => c.id) ?? [];
  return useQuery<CharacterDetails, ApiError>({
    queryKey: ["characters", profile.id, ref.game, ref.uid, ids.join(",")],
    queryFn: async ({ signal }) => {
      const byId: Record<string, Character> = {};
      if (roster?.details) {
        for (const c of roster.details) byId[c.id] = c;
        return { byId };
      }
      const account = await loadAccount(qc, profile, ref);
      for (const part of chunk(ids, DETAIL_CHUNK)) {
        try {
          for (const c of await adapter!.fetchDetails(account, part, signal)) byId[c.id] = c;
        } catch (e) {
          const err = asApiError(e);
          if (!(err instanceof ApiError)) throw err;
          if (Object.keys(byId).length === 0) throw err;
          return { byId, error: err };
        }
      }
      return { byId };
    },
    enabled: !!adapter?.prefetchDetails && !!roster,
    staleTime: CHARACTER_STALE,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Details einer Figur: aus dem Vorladen, sonst einzeln beim Öffnen (ZZZ). */
export function useCharacter(profile: Profile, ref: GameAccountRef, roster: Roster | undefined, id: string) {
  const qc = useQueryClient();
  const adapter = CHARACTER_ADAPTERS[ref.game];
  const bulk = useCharacterDetails(profile, ref, roster);
  const single = useQuery<Character | null, ApiError>({
    queryKey: ["character", profile.id, ref.game, ref.uid, id],
    queryFn: async ({ signal }) => {
      try {
        const [c] = await adapter!.fetchDetails(await loadAccount(qc, profile, ref), [id], signal);
        return c ?? null;
      } catch (e) {
        throw asApiError(e);
      }
    },
    enabled: !!adapter && !adapter.prefetchDetails && !!roster,
    staleTime: CHARACTER_STALE,
    refetchOnWindowFocus: false,
    retry: false,
  });
  return adapter?.prefetchDetails
    ? {
        character: bulk.data?.byId[id],
        error: bulk.error ?? bulk.data?.error ?? null,
        loaded: !!bulk.data && !bulk.isFetching,
      }
    : { character: single.data ?? undefined, error: single.error, loaded: single.isFetched && !single.isFetching };
}

// Herausforderungen wechseln nur alle paar Wochen: wie die Figuren 30 Minuten frisch und kein Intervall.
export function challengeKey(profileId: string, ref: Pick<GameAccountRef, "game" | "uid">) {
  return ["challenge", profileId, ref.game, ref.uid] as const;
}

/** Eine Periode eines Modus, pro Modus ein eigener Aufruf, damit ein Fehler nur dessen Karte betrifft. */
export function useChallenge(profile: Profile, ref: GameAccountRef, mode: ChallengeMode, period: ChallengePeriod) {
  const qc = useQueryClient();
  return useQuery<Challenge, ApiError>({
    queryKey: [...challengeKey(profile.id, ref), mode.key, period],
    queryFn: async ({ signal }) => {
      try {
        return await mode.fetch(await loadAccount(qc, profile, ref), period, signal);
      } catch (e) {
        throw asApiError(e);
      }
    },
    staleTime: CHARACTER_STALE,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
