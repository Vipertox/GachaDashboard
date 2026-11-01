import { useState } from "react";
import { useEvents, useNow } from "../../app/hooks";
import { EVENT_ADAPTERS } from "../../api/events";
import { ApiError, ERROR_TEXT } from "../../api/errors";
import { BottomSheet, Card, GameIcon, ProgressBar, Skeleton } from "../../components/ui";
import { formatDuration } from "../../lib/time";
import { RARITY_COLOR } from "../../model/games";
import type { Banner, GameAccountRef, GameEvent, Profile } from "../../model/types";
import { bannerOrder, byTime } from "./eventView";

// Wie bei den Herausforderungen: ab drei Tagen vor Ende wird ein offenes Event hervorgehoben.
const ENDING_SOON_MS = 3 * 86400_000;
const VISIBLE = 5;

/** 10102 heißt hier, dass die Kampfchronik in HoYoLAB nicht öffentlich ist. */
function eventErrorText(e: ApiError): string {
  return e.kind === "notes_disabled"
    ? "Kampfchronik in HoYoLAB unter Datenschutz freigeben"
    : `${ERROR_TEXT[e.kind]}: ${e.message}`;
}

const fmtDate = (d: Date) =>
  d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function endingSoon(e: GameEvent, now: number): boolean {
  if (e.status !== "running" || !e.end) return false;
  const left = e.end.getTime() - now;
  return left > 0 && left < ENDING_SOON_MS;
}

function progressText(p: NonNullable<GameEvent["progress"]>): string {
  if (p.unit === "%") return `${p.current} %`;
  return `${p.current}/${p.max}${p.unit ? ` ${p.unit}` : ""}`;
}

function whenText(x: { status: GameEvent["status"]; start?: Date; end?: Date }, now: number): string | undefined {
  if (x.status === "upcoming" && x.start) return `startet in ${formatDuration(x.start.getTime() - now)}`;
  if (x.end) return `endet in ${formatDuration(x.end.getTime() - now)}`;
  return undefined;
}

function EventRow({ e, now, accent, onOpen }: { e: GameEvent; now: number; accent: string; onOpen: () => void }) {
  const done = e.status === "done";
  const soon = endingSoon(e, now);
  const when = whenText(e, now);
  return (
    <li>
      <button className="w-full text-left space-y-1.5 min-h-11 active:opacity-70" onClick={onOpen}>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 min-w-0">
            <span aria-hidden style={{ color: done ? "var(--color-ok)" : "var(--muted)" }}>
              {done ? "✓" : "○"}
            </span>
            <span className="truncate">{e.name}</span>
            {e.tag && (
              <span className="shrink-0 rounded-full px-2 text-xs" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                {e.tag}
              </span>
            )}
          </span>
          {e.progress && <span className="shrink-0 text-sm font-semibold">{progressText(e.progress)}</span>}
        </div>
        {e.progress && e.status !== "upcoming" && (
          <ProgressBar
            frac={e.progress.max ? Math.min(1, e.progress.current / e.progress.max) : 0}
            accent={accent}
            height={6}
            mode="progress"
          />
        )}
        {(done || when) && (
          <div className="text-xs" style={{ color: soon ? "var(--color-warn)" : "var(--muted)" }}>
            {soon && "⚠ "}
            {[done ? "Erledigt" : undefined, when].filter(Boolean).join(" · ")}
          </div>
        )}
      </button>
    </li>
  );
}

function EventSheet({ e, onClose }: { e: GameEvent | undefined; onClose: () => void }) {
  return (
    <BottomSheet open={!!e} onClose={onClose} title={e?.name ?? ""}>
      {e && (
        <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
          {(e.start || e.end) && (
            <p style={{ color: "var(--muted)" }}>
              {e.start && fmtDate(e.start)}
              {e.start && e.end && " – "}
              {e.end && fmtDate(e.end)}
            </p>
          )}
          {e.description && <p className="whitespace-pre-line">{e.description}</p>}
          {e.rewards.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Belohnungen</h3>
              <ul className="flex flex-wrap gap-2">
                {e.rewards.map((r, i) => (
                  <li
                    key={`${r.name}-${i}`}
                    className="flex items-center gap-1.5 rounded-full pl-1 pr-3 min-h-8"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <GameIcon url={r.iconUrl} size={24} round label={r.name} />
                    {r.name}
                    {r.count > 0 && <span className="font-semibold">×{r.count.toLocaleString("de-DE")}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!e.description && e.rewards.length === 0 && (
            <p style={{ color: "var(--muted)" }}>Die Schnittstelle liefert keine weiteren Angaben zu diesem Event.</p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function BannerRow({ b, now }: { b: Banner; now: number }) {
  const when = whenText(b, now);
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium">{b.name}</span>
        {when && (
          <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
            {when}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[...b.items]
          .sort((x, y) => y.rarity - x.rarity)
          .map((i, n) => (
            <span
              key={`${i.name}-${n}`}
              title={i.name}
              className="flex items-center gap-1 rounded-full pl-0.5 pr-2 text-xs min-h-7"
              style={{ background: "var(--surface-2)", boxShadow: `inset 0 0 0 1px ${RARITY_COLOR[i.rarity] ?? "transparent"}` }}
            >
              <GameIcon url={i.iconUrl} size={24} round label={i.name} />
              {i.name}
            </span>
          ))}
      </div>
    </li>
  );
}

/** Abschnitt "Events" in der Übersicht, darunter die laufenden Banner. */
export function EventsSection({ profile, gameRef, accent }: { profile: Profile; gameRef: GameAccountRef; accent: string }) {
  const q = useEvents(profile, gameRef);
  const now = useNow();
  const [all, setAll] = useState(false);
  const [openId, setOpenId] = useState<string>();
  if (!EVENT_ADAPTERS[gameRef.game]) return null;

  const events = q.data?.events ?? [];
  const current = events.filter((e) => e.status !== "upcoming").sort(byTime);
  const upcoming = events.filter((e) => e.status === "upcoming").sort(byTime);
  const shown = all ? current : current.slice(0, VISIBLE);
  const banners = [...(q.data?.banners ?? [])].sort(bannerOrder);

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          Events
        </h2>
        <Card>
          <div className="p-4 space-y-4">
            {q.isError ? (
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                {eventErrorText(q.error)}
              </p>
            ) : !q.data ? (
              <Skeleton className="h-16" />
            ) : events.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                Gerade keine Events.
              </p>
            ) : (
              <>
                {shown.length > 0 && (
                  <ul className="space-y-3">
                    {shown.map((e) => (
                      <EventRow key={e.id} e={e} now={now} accent={accent} onOpen={() => setOpenId(e.id)} />
                    ))}
                  </ul>
                )}
                {current.length > VISIBLE && (
                  <button className="min-h-9 text-sm text-indigo-400" onClick={() => setAll(!all)}>
                    {all ? "Weniger anzeigen ▴" : `Alle ${current.length} Events anzeigen ▾`}
                  </button>
                )}
                {upcoming.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                      Demnächst
                    </h3>
                    <ul className="space-y-3">
                      {upcoming.map((e) => (
                        <EventRow key={e.id} e={e} now={now} accent={accent} onOpen={() => setOpenId(e.id)} />
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </section>
      {banners.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Banner
          </h2>
          <Card>
            <ul className="p-4 space-y-4">
              {banners.map((b) => (
                <BannerRow key={b.id} b={b} now={now} />
              ))}
            </ul>
          </Card>
        </section>
      )}
      <EventSheet e={events.find((e) => e.id === openId)} onClose={() => setOpenId(undefined)} />
    </>
  );
}
