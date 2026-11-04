import { Link } from "react-router-dom";
import { BottomSheet, GameIcon, ProgressBar } from "../../components/ui";
import { imageFor } from "../../assets/registry";
import type { ApiError } from "../../api/errors";
import type { GameEvent } from "../../model/types";
import { CurrencyBadge, endingSoon, eventErrorText, progressText, whenText } from "../game-detail/Events";
import type { WeeklySummary } from "./taskSummary";

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
  accent,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  summary: WeeklySummary;
  accent: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <ul className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
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
              const soon = endingSoon(e, now);
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
