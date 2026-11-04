import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { challengeKey, useChallenge, useNow } from "../../app/hooks";
import { CHALLENGE_MODES } from "../../api/challenges";
import { ApiError, ERROR_TEXT } from "../../api/errors";
import { Card, ProgressBar, Skeleton } from "../../components/ui";
import { formatDuration } from "../../lib/time";
import type { Challenge, ChallengeMode, ChallengePeriod, GameAccountRef, Profile } from "../../model/types";

// Ab drei Tagen vor Ende wird ein unvollständiger Modus hervorgehoben.
const ENDING_SOON_MS = 3 * 86400_000;

/** Fehlertext für Herausforderungen; 10102 heißt hier, dass die Kampfchronik nicht öffentlich ist. */
function challengeErrorText(e: ApiError): string {
  return e.kind === "notes_disabled"
    ? "Kampfchronik in HoYoLAB unter Datenschutz freigeben"
    : `${ERROR_TEXT[e.kind]}: ${e.message}`;
}

const fmtDate = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

/** Läuft noch, endet bald und ist nicht vollständig. */
function endingSoon(c: Challenge, now: number): boolean {
  if (!c.end || c.state === "locked") return false;
  const left = c.end.getTime() - now;
  const open = c.state === "empty" || (!!c.progress && c.progress.current < c.progress.max);
  return left > 0 && left < ENDING_SOON_MS && open;
}

function periodText(c: Challenge, period: ChallengePeriod, now: number): string | undefined {
  if (!c.end) return undefined;
  const left = c.end.getTime() - now;
  if (period === "previous" || left <= 0) return c.start ? `${fmtDate(c.start)}–${fmtDate(c.end)}` : `bis ${fmtDate(c.end)}`;
  return `läuft bis ${fmtDate(c.end)} · noch ${formatDuration(left)}`;
}

const STATE_TEXT: Record<Exclude<Challenge["state"], "ok">, string> = {
  locked: "Noch nicht freigeschaltet",
  empty: "In dieser Periode noch nicht gespielt",
};

function ChallengeCard({
  profile,
  gameRef,
  mode,
  accent,
}: {
  profile: Profile;
  gameRef: GameAccountRef;
  mode: ChallengeMode;
  accent: string;
}) {
  const [period, setPeriod] = useState<ChallengePeriod>("current");
  const q = useChallenge(profile, gameRef, mode, period);
  const now = useNow();
  const c = q.data;
  const soon = !!c && period === "current" && endingSoon(c, now);
  const when = c && periodText(c, period, now);
  return (
    <Card>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">{mode.label}</h3>
            {c?.season && (
              <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                {c.season}
              </div>
            )}
          </div>
          <div className="flex rounded-lg p-0.5 gap-0.5 shrink-0 text-xs" role="group" style={{ background: "var(--surface-2)" }}>
            {(
              [
                ["current", "Aktuell"],
                ["previous", "Vorherige"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={period === key}
                className="min-h-8 px-2 rounded-md"
                style={period === key ? { background: "var(--surface)" } : { color: "var(--muted)" }}
                onClick={() => setPeriod(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {when && (
          <div className="text-sm" style={{ color: soon ? "var(--color-warn)" : "var(--muted)" }}>
            {soon && "⚠ "}
            {when}
          </div>
        )}
        {q.isError ? (
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>
            {challengeErrorText(q.error)}
          </p>
        ) : !c ? (
          <Skeleton className="h-12" />
        ) : c.state !== "ok" ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {STATE_TEXT[c.state]}
          </p>
        ) : (
          <>
            {c.progress && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>{c.progress.unit}</span>
                  <span className="font-semibold">
                    {c.progress.current.toLocaleString("de-DE")}/{c.progress.max.toLocaleString("de-DE")}
                  </span>
                </div>
                <ProgressBar
                  frac={c.progress.max ? Math.min(1, c.progress.current / c.progress.max) : 0}
                  accent={accent}
                  height={6}
                  mode="progress"
                />
              </div>
            )}
            {c.facts.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {c.facts.map((f) => (
                  <div key={f.label} className={f.value.length > 14 ? "col-span-2" : ""}>
                    <dt style={{ color: "var(--muted)" }}>{f.label}</dt>
                    <dd className="font-semibold">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/** Tab "Herausforderungen": eine Karte pro Modus, geladen erst beim Öffnen des Tabs. */
export function Challenges({ profile, gameRef, accent }: { profile: Profile; gameRef: GameAccountRef; accent: string }) {
  const qc = useQueryClient();
  const modes = CHALLENGE_MODES[gameRef.game] ?? [];
  const key = challengeKey(profile.id, gameRef);
  // Abonniert den Ladezustand; qc.isFetching() läse ihn nur einmal beim Rendern
  const fetching = useIsFetching({ queryKey: key }) > 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm" style={{ color: "var(--muted)" }}>
        <span>{modes.length} Modi</span>
        <button className="min-h-9 px-2" onClick={() => void qc.invalidateQueries({ queryKey: key })} disabled={fetching}>
          {fetching ? "Lädt …" : "↻ Neu laden"}
        </button>
      </div>
      {modes.map((m) => (
        <ChallengeCard key={m.key} profile={profile} gameRef={gameRef} mode={m} accent={accent} />
      ))}
    </div>
  );
}

function SummaryRow({ profile, gameRef, mode }: { profile: Profile; gameRef: GameAccountRef; mode: ChallengeMode }) {
  const q = useChallenge(profile, gameRef, mode, "current");
  const now = useNow();
  const c = q.data;
  const left = c?.end ? c.end.getTime() - now : undefined;
  const soon = !!c && endingSoon(c, now);
  let value = "…";
  if (q.isError) value = "Fehler";
  else if (c) value = c.state === "ok" ? (c.summary ?? "Gespielt") : c.state === "locked" ? "Gesperrt" : "Offen";
  return (
    <span className="flex items-center justify-between gap-3 text-sm">
      <span className="truncate">{mode.label}</span>
      <span className="shrink-0 text-right">
        <span className="font-semibold">{value}</span>
        {left !== undefined && left > 0 && (
          <span style={{ color: soon ? "var(--color-warn)" : "var(--muted)" }}> · endet in {formatDuration(left)}</span>
        )}
      </span>
    </span>
  );
}

/** Kompakte Zeilen für die Übersicht, ein Tipp öffnet den Tab. Teilt sich die Abfragen mit dem Tab. */
export function ChallengeSummary({ profile, gameRef, onOpen }: { profile: Profile; gameRef: GameAccountRef; onOpen: () => void }) {
  const modes = CHALLENGE_MODES[gameRef.game];
  if (!modes?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Herausforderungen
      </h2>
      {/* Button in der Karte statt Karte (div) und Liste (ul) im Button: beides ist dort kein gültiges HTML */}
      <Card>
        <button className="block w-full text-left p-4 space-y-2 active:opacity-70" onClick={onOpen} aria-label="Herausforderungen öffnen">
          {modes.map((m) => (
            <SummaryRow key={m.key} profile={profile} gameRef={gameRef} mode={m} />
          ))}
        </button>
      </Card>
    </section>
  );
}
