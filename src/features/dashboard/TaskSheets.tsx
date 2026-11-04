import { Link } from "react-router-dom";
import { BottomSheet, GameIcon, ProgressBar } from "../../components/ui";
import { imageFor } from "../../assets/registry";
import type { ApiError } from "../../api/errors";
import { formatDuration } from "../../lib/time";
import type { Challenge, ChallengeMode, GameEvent } from "../../model/types";
import { challengeEndingSoon, endsSoon, eventEndingSoon } from "../../lib/endingSoon";
import { challengeErrorText, STATE_TEXT } from "../game-detail/Challenges";
import { CurrencyBadge, eventErrorText, progressText, whenText } from "../game-detail/Events";
import { challengeCounts, challengeDone, type WeeklySummary } from "./taskSummary";

function StateMark({ done }: { done: boolean }) {
  return (
    <span aria-hidden style={{ color: done ? "var(--color-ok)" : "var(--muted)" }}>
      {done ? "✓" : "○"}
    </span>
  );
}

export function WeeklySheet({
  open,
  onClose,
  title,
  summary,
  resetAt,
  now,
  accent,
  detailPath,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  summary: WeeklySummary;
  resetAt: Date;
  now: number;
  accent: string;
  detailPath: string;
}) {
  const soon = summary.open > 0 && endsSoon(resetAt, now);
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="space-y-3 text-sm">
        <p className="text-xs" style={{ color: soon ? "var(--color-warn)" : "var(--muted)" }}>
          {soon && "⚠ "}Wochenreset in {formatDuration(resetAt.getTime() - now)}
        </p>
        <ul className="space-y-3 max-h-[55vh] overflow-y-auto">
          {summary.items.map((i) => (
            <li key={i.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <StateMark done={i.done} />
                  {i.iconKey && imageFor(i.iconKey) && <GameIcon iconKey={i.iconKey} size={20} round />}
                  <span className="truncate">{i.label}</span>
                </span>
                {i.text && <span className="shrink-0 font-semibold">{i.text}</span>}
              </div>
              {i.frac !== undefined && <ProgressBar frac={i.frac} accent={accent} height={6} mode="progress" />}
            </li>
          ))}
        </ul>
        {/* Wöchentliches steht im Übersicht-Tab der Detailseite, dem Standard-Tab */}
        <Link to={detailPath} className="inline-flex items-center min-h-11 text-indigo-400 underline" onClick={onClose}>
          Alle Details
        </Link>
      </div>
    </BottomSheet>
  );
}

export function OpenEventsSheet({
  open,
  onClose,
  title,
  events,
  error,
  now,
  accent,
  detailPath,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  events: GameEvent[];
  error?: ApiError;
  now: number;
  accent: string;
  detailPath: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="space-y-3 text-sm">
        {error ? (
          <p style={{ color: "var(--color-danger)" }}>{eventErrorText(error)}</p>
        ) : events.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>Alle laufenden Events sind erledigt.</p>
        ) : (
          <ul className="space-y-3 max-h-[55vh] overflow-y-auto">
            {events.map((e) => {
              const soon = eventEndingSoon(e, now);
              const when = whenText(e, now);
              return (
                <li key={e.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <StateMark done={false} />
                      <span className="truncate">{e.name}</span>
                    </span>
                    {e.progress && <span className="shrink-0 font-semibold">{progressText(e.progress)}</span>}
                  </div>
                  {e.progress && (
                    <ProgressBar
                      frac={e.progress.max ? Math.min(1, e.progress.current / e.progress.max) : 0}
                      accent={accent}
                      height={6}
                      mode="progress"
                    />
                  )}
                  {(when || e.currency) && (
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span style={{ color: soon ? "var(--color-warn)" : "var(--muted)" }}>
                        {soon && "⚠ "}
                        {when}
                      </span>
                      {e.currency && <CurrencyBadge c={e.currency} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Link to={detailPath} className="inline-flex items-center min-h-11 text-indigo-400 underline" onClick={onClose}>
          Alle Events
        </Link>
      </div>
    </BottomSheet>
  );
}

export interface ChallengeResult {
  mode: ChallengeMode;
  data?: Challenge;
  error?: ApiError | null;
}

function ChallengeRow({ r, now, accent }: { r: ChallengeResult; now: number; accent: string }) {
  const c = r.data;
  const counted = !!c && challengeCounts(c, now);
  const done = counted && challengeDone(c);
  const soon = !!c && challengeEndingSoon(c, now);
  const left = c?.end ? c.end.getTime() - now : undefined;
  let value: string | undefined;
  if (c?.state === "ok") value = c.progress ? `${c.progress.current}/${c.progress.max} ${c.progress.unit}` : (c.summary ?? "Gespielt");
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 min-w-0">
          {counted ? <StateMark done={done} /> : <span aria-hidden style={{ color: "var(--muted)" }}>–</span>}
          <span className="truncate">{r.mode.label}</span>
        </span>
        {value && <span className="shrink-0 font-semibold">{value}</span>}
      </div>
      {c?.state === "ok" && c.progress && (
        <ProgressBar
          frac={c.progress.max ? Math.min(1, c.progress.current / c.progress.max) : 0}
          accent={accent}
          height={6}
          mode="progress"
        />
      )}
      <div className="text-xs" style={{ color: r.error && !c ? "var(--color-danger)" : soon ? "var(--color-warn)" : "var(--muted)" }}>
        {!c
          ? r.error
            ? challengeErrorText(r.error)
            : "Lädt …"
          : [c.state !== "ok" ? STATE_TEXT[c.state] : undefined, left !== undefined && left > 0 ? `${soon ? "⚠ " : ""}endet in ${formatDuration(left)}` : undefined]
              .filter(Boolean)
              .join(" · ")}
      </div>
    </li>
  );
}

export function ChallengesSheet({
  open,
  onClose,
  title,
  results,
  now,
  accent,
  detailPath,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  results: ChallengeResult[];
  now: number;
  accent: string;
  detailPath: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="space-y-3 text-sm">
        <ul className="space-y-3 max-h-[55vh] overflow-y-auto">
          {results.map((r) => (
            <ChallengeRow key={r.mode.key} r={r} now={now} accent={accent} />
          ))}
        </ul>
        <Link
          to={`${detailPath}?tab=herausforderungen`}
          className="inline-flex items-center min-h-11 text-indigo-400 underline"
          onClick={onClose}
        >
          Alle Herausforderungen
        </Link>
      </div>
    </BottomSheet>
  );
}
