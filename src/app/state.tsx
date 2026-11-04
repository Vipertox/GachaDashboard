import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { deleteSecrets, saveSecrets, type ProfileSecrets } from "../credentials";
import { DEFAULT_SETTINGS, type AppSettings, type Profile, type ProfileState } from "../model/types";
import { loadState, saveState } from "../storage/settings";

interface AppState {
  ready: boolean;
  loadError?: string;
  profiles: Profile[];
  activeProfile?: Profile;
  settings: AppSettings;
  setActive(id: string): void;
  saveProfile(profile: Profile, secrets: ProfileSecrets): Promise<void>;
  updateProfile(profile: Profile): void;
  deleteProfile(id: string): Promise<void>;
  updateSettings(s: Partial<AppSettings>): void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider fehlt");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [ps, setPs] = useState<ProfileState>({ profiles: [], activeProfileId: "" });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  // Stand für die Aktionen unten. Wird nicht beim Rendern, sondern bei jeder Änderung sofort
  // gesetzt, damit mehrere Aktionen im selben Handler aufeinander aufbauen statt sich zu überschreiben.
  const latest = useRef({ ps, settings });

  useEffect(() => {
    loadState()
      .then((s) => {
        latest.current = { ps: s.profileState, settings: s.settings };
        setPs(s.profileState);
        setSettings(s.settings);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setReady(true));
  }, []);

  const commit = useCallback((nextPs: ProfileState, nextSettings: AppSettings) => {
    latest.current = { ps: nextPs, settings: nextSettings };
    setPs(nextPs);
    setSettings(nextSettings);
    saveState({ profileState: nextPs, settings: nextSettings }).catch((e) =>
      setLoadError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  /** Laufende Anfragen eines Profils abbrechen und seinen Cache verwerfen. */
  const dropProfileCache = useCallback(
    (profileId: string) => {
      const filter = { predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[1] === profileId };
      void qc.cancelQueries(filter);
      qc.removeQueries(filter);
    },
    [qc],
  );

  const value = useMemo<AppState>(() => {
    const activeProfile = ps.profiles.find((p) => p.id === ps.activeProfileId) ?? ps.profiles[0];
    return {
      ready,
      loadError,
      profiles: ps.profiles,
      activeProfile,
      settings,
      setActive(id) {
        const { ps: cur, settings: st } = latest.current;
        if (id === cur.activeProfileId) return;
        if (cur.activeProfileId) dropProfileCache(cur.activeProfileId);
        commit({ ...cur, activeProfileId: id }, st);
      },
      async saveProfile(profile, secrets) {
        await saveSecrets(profile.id, secrets);
        const { ps: cur, settings: st } = latest.current;
        const exists = cur.profiles.some((p) => p.id === profile.id);
        const profiles = exists
          ? cur.profiles.map((p) => (p.id === profile.id ? profile : p))
          : [...cur.profiles, profile];
        dropProfileCache(profile.id);
        void qc.invalidateQueries({ queryKey: ["secrets", profile.id] });
        commit({ profiles, activeProfileId: cur.activeProfileId || profile.id }, st);
      },
      updateProfile(profile) {
        const { ps: cur, settings: st } = latest.current;
        commit({ ...cur, profiles: cur.profiles.map((p) => (p.id === profile.id ? profile : p)) }, st);
      },
      async deleteProfile(id) {
        await deleteSecrets(id);
        dropProfileCache(id);
        qc.removeQueries({ queryKey: ["secrets", id] });
        const { ps: cur, settings: st } = latest.current;
        const profiles = cur.profiles.filter((p) => p.id !== id);
        const activeProfileId = cur.activeProfileId === id ? (profiles[0]?.id ?? "") : cur.activeProfileId;
        commit({ profiles, activeProfileId }, st);
      },
      updateSettings(s) {
        const { ps: cur, settings: st } = latest.current;
        commit(cur, { ...st, ...s });
      },
    };
  }, [ps, settings, ready, loadError, commit, dropProfileCache, qc]);

  // Design nach Einstellung oder Systemvorgabe
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
