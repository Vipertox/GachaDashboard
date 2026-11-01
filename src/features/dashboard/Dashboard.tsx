import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type TouchEvent } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../app/state";
import { useGameStatuses, useNow, visibleGames } from "../../app/hooks";
import { btnPrimary } from "../../components/ui";
import { formatDuration, isFull } from "../../lib/time";
import { haptic } from "../../lib/native";
import { GAME_META } from "../../model/games";
import type { Profile } from "../../model/types";
import { GameCard } from "./GameCard";

function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const threshold = 70;
  return {
    pull,
    busy,
    handlers: {
      onTouchStart(e: TouchEvent) {
        if (window.scrollY <= 0) startY.current = e.touches[0].clientY;
      },
      onTouchMove(e: TouchEvent) {
        if (startY.current === null) return;
        const dy = e.touches[0].clientY - startY.current;
        setPull(dy > 0 ? Math.min(dy * 0.5, 100) : 0);
      },
      async onTouchEnd() {
        const triggered = pull >= threshold;
        startY.current = null;
        setPull(0);
        if (triggered && !busy) {
          haptic(25);
          setBusy(true);
          try {
            await onRefresh();
          } finally {
            setBusy(false);
          }
        }
      },
    },
  };
}

function Summary({ profile }: { profile: Profile }) {
  const refs = visibleGames(profile);
  const results = useGameStatuses(profile, refs);
  const now = useNow();
  let best: { name: string; ms: number; full: boolean } | undefined;
  results.forEach((r, i) => {
    const p = r.data?.primary;
    if (!p) return;
    const name = GAME_META[refs[i].game].name;
    if (isFull(p, now)) {
      if (!best || !best.full) best = { name, ms: 0, full: true };
    } else if (p.fullAt && (!best || (!best.full && p.fullAt.getTime() - now < best.ms))) {
      best = { name, ms: p.fullAt.getTime() - now, full: false };
    }
  });
  if (!best) return null;
  return (
    <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {best.full ? (
        <>
          <b>{best.name}</b> ist voll und läuft über
        </>
      ) : (
        <>
          Als Nächstes voll: <b>{best.name}</b> in {formatDuration(best.ms)}
        </>
      )}
    </div>
  );
}

export function Dashboard() {
  const { activeProfile } = useApp();
  const qc = useQueryClient();
  const refresh = () => qc.refetchQueries({ queryKey: ["status", activeProfile?.id] });
  const ptr = usePullToRefresh(refresh);

  if (!activeProfile) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-lg">Noch kein Profil angelegt.</p>
        <Link to="/accounts?new=1" className={btnPrimary}>
          Einrichtung starten
        </Link>
      </div>
    );
  }

  const games = visibleGames(activeProfile);
  return (
    <div {...ptr.handlers} className="space-y-4">
      <div
        className="text-center text-sm overflow-hidden transition-[height]"
        style={{ height: ptr.busy ? 28 : ptr.pull * 0.4, color: "var(--muted)" }}
      >
        {ptr.busy ? "Aktualisiere …" : ptr.pull >= 70 ? "Loslassen zum Aktualisieren" : ptr.pull > 0 ? "Zum Aktualisieren ziehen" : ""}
      </div>
      <Summary profile={activeProfile} />
      {games.length === 0 ? (
        <p className="text-center py-10" style={{ color: "var(--muted)" }}>
          Dieses Profil hat noch keine Spiele. Unter Konten die Tokens eintragen und prüfen.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {games.map((g) => (
            <GameCard key={`${g.game}-${g.uid}`} profile={activeProfile} gameRef={g} />
          ))}
        </div>
      )}
      <button
        onClick={() => void refresh()}
        className="hidden md:inline-flex min-h-11 px-4 rounded-xl items-center"
        style={{ background: "var(--surface-2)" }}
      >
        Aktualisieren
      </button>
    </div>
  );
}
