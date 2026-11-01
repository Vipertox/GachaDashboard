import { Link } from "react-router-dom";
import { useGameStatus, useNow } from "../../app/hooks";
import { ERROR_TEXT } from "../../api/errors";
import { Card, GameIcon, OverflowDot, ResourceBar, Skeleton, ValueText, Chip } from "../../components/ui";
import { formatClock, formatDuration, isFull } from "../../lib/time";
import { haptic } from "../../lib/native";
import { GAME_ACCENT } from "../../model/games";
import { GAME_META } from "../../model/games";
import type { GameAccountRef, Profile } from "../../model/types";

export function GameCard({ profile, gameRef }: { profile: Profile; gameRef: GameAccountRef }) {
  const meta = GAME_META[gameRef.game];
  const accent = GAME_ACCENT[gameRef.game];
  const q = useGameStatus(profile, gameRef);
  const now = useNow();
  const status = q.data;
  const stale = q.isError && !!status;

  const header = (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 28%, var(--surface)), var(--surface))` }}
    >
      <GameIcon iconKey={meta.iconKey} size={36} label={meta.name} />
      <div className="min-w-0">
        <div className="font-semibold leading-tight truncate">{meta.name}</div>
        <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
          {gameRef.nickname ?? status?.nickname ?? gameRef.uid} · {gameRef.uid}
        </div>
      </div>
    </div>
  );

  let body;
  if (!status && q.isPending) {
    body = (
      <div className="p-4 space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  } else if (!status && q.isError) {
    const kind = q.error.kind;
    body = (
      <div className="p-4 space-y-2">
        <div className="font-medium" style={{ color: "var(--color-danger)" }}>
          {ERROR_TEXT[kind]}
        </div>
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          {q.error.message}
        </div>
        {(kind === "auth" || kind === "missing_credentials") && (
          <span className="inline-flex items-center min-h-11 text-indigo-400 underline">Zur Einrichtung</span>
        )}
      </div>
    );
  } else if (status) {
    const p = status.primary;
    const full = isFull(p, now);
    const daily = status.sections.find((s) => s.kind === "daily");
    body = (
      <div className={`p-4 space-y-3 ${stale ? "opacity-60" : ""}`}>
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <GameIcon iconKey={p.iconKey} size={32} label={p.label} />
            <span className="text-sm truncate" style={{ color: "var(--muted)" }}>
              {p.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-2xl font-semibold">
            <OverflowDot r={p} now={now} />
            <ValueText r={p} now={now} />
          </div>
        </div>
        <ResourceBar r={p} now={now} accent={accent} />
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          {full || !p.fullAt
            ? "Voll"
            : `Voll um ${formatClock(p.fullAt, now)} · in ${formatDuration(p.fullAt.getTime() - now)}`}
        </div>
        {daily && daily.tasks.length + daily.flags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {daily.tasks.map((t) => (
              <Chip key={t.label} done={t.done >= t.total}>
                {t.label} {t.done}/{t.total}
              </Chip>
            ))}
          </div>
        )}
        {stale && (
          <div className="text-xs" style={{ color: "var(--color-warn)" }}>
            {ERROR_TEXT[q.error.kind]} · Stand von {status.fetchedAt.toLocaleTimeString("de-DE")}
          </div>
        )}
      </div>
    );
  }

  const content = (
    <Card accent={accent}>
      {header}
      {body}
    </Card>
  );

  if (!status) {
    const needsSetup = q.isError && (q.error.kind === "auth" || q.error.kind === "missing_credentials");
    return needsSetup ? <Link to="/accounts">{content}</Link> : content;
  }
  return (
    <Link to={`/game/${gameRef.game}/${gameRef.uid}`} onClick={() => haptic()} className="block active:opacity-80">
      {content}
    </Link>
  );
}
