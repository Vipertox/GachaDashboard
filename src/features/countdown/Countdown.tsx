import { useState } from "react";
import { useApp } from "../../app/state";
import { useEventCalendars, useGameArt, useNow, useVersionFacts, visibleGames } from "../../app/hooks";
import { EVENT_ADAPTERS } from "../../api/events";
import { bannerFacts, mergeVersionFacts, rankFacts, VERSION_GAMES } from "../../api/versions";
import { ERROR_TEXT, type ApiError } from "../../api/errors";
import { Card, GameIcon, Skeleton } from "../../components/ui";
import { GAME_ACCENT, GAME_META } from "../../model/games";
import type { Banner, GameAccountRef, GameId, Profile, VersionInfo } from "../../model/types";
import { ExternalLink } from "../game-detail/Events";
import { countdownParts, loadSortByTime, saveSortByTime, sortByCountdown } from "./countdownView";

/** Bannerkalender von HoYoLAB als Quelle; der Kalender von Wuthering Waves stammt aus dem Wiki und zählt nicht. */
const BANNER_GAMES: GameId[] = ["genshin", "starrail", "zzz"];

const fmtDate = (d: Date) =>
  d.toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function CountdownPage() {
  const { activeProfile } = useApp();
  const [sortByTime, setSortByTime] = useState(loadSortByTime);
  const toggle = () => {
    setSortByTime(!sortByTime);
    saveSortByTime(!sortByTime);
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Countdown</h1>
        <Switch on={sortByTime} onToggle={toggle} label="Nach Countdown sortieren" />
      </div>
      {activeProfile ? (
        <WithProfile profile={activeProfile} sortByTime={sortByTime} />
      ) : (
        <Countdowns games={VERSION_GAMES} banners={{}} icons={{}} sortByTime={sortByTime} />
      )}
    </div>
  );
}

/** An/Aus-Schalter; die ganze Zeile ist die Fläche zum Tippen. */
function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} onClick={onToggle} className="min-h-11 flex items-center gap-2 text-sm">
      <span className="whitespace-nowrap" style={{ color: on ? "var(--text)" : "var(--muted)" }}>{label}</span>
      <span
        aria-hidden
        className="relative w-11 h-6 rounded-full shrink-0 transition-colors"
        style={{ background: on ? "#6366f1" : "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <span
          className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white transition-all"
          style={{ left: on ? 22 : 2 }}
        />
      </span>
    </button>
  );
}

/**
 * Mit Profil: dessen sichtbare Spiele in der Reihenfolge des Dashboards (Einstellungen), dazu der
 * Bannerkalender des ersten Kontos je Spiel.
 */
function WithProfile({ profile, sortByTime }: { profile: Profile; sortByTime: boolean }) {
  const refs = visibleGames(profile);
  const games = refs.length ? [...new Set(refs.map((r) => r.game))].filter((g) => VERSION_GAMES.includes(g)) : VERSION_GAMES;
  const bannerRefs = games
    .filter((g) => BANNER_GAMES.includes(g) && EVENT_ADAPTERS[g])
    .map((g) => refs.find((r) => r.game === g))
    .filter((r): r is GameAccountRef => !!r);
  const calendars = useEventCalendars(profile, bannerRefs);
  const art = useGameArt(profile).data;
  const banners: Partial<Record<GameId, Banner[]>> = {};
  bannerRefs.forEach((r, i) => {
    const data = calendars[i]?.data;
    if (data) banners[r.game] = data.banners;
  });
  const icons: IconUrls = {};
  for (const g of games) icons[g] = art?.[g]?.iconUrl;
  return <Countdowns games={games} banners={banners} icons={icons} sortByTime={sortByTime} />;
}

type IconUrls = Partial<Record<GameId, string>>;

function Countdowns({
  games,
  banners,
  icons,
  sortByTime,
}: {
  games: GameId[];
  banners: Partial<Record<GameId, Banner[]>>;
  icons: IconUrls;
  sortByTime: boolean;
}) {
  const now = useNow();
  const queries = useVersionFacts(games);
  const rows = games.map((game, i) => {
    const q = queries[i];
    const fromBanners = banners[game] ? bannerFacts(banners[game]!, new Date(now)) : undefined;
    const info = q.data ? mergeVersionFacts(game, rankFacts(q.data, fromBanners), new Date(now)) : undefined;
    return { game, info, loading: q.isPending, error: q.error as ApiError | null };
  });
  const shown = sortByTime ? sortByCountdown(rows) : rows;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {shown.map((r) => (
        <Card key={r.game} accent={GAME_ACCENT[r.game]}>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <GameIcon iconKey={GAME_META[r.game].iconKey} url={icons[r.game]} label={GAME_META[r.game].name} size={40} />
              <h2 className="font-semibold truncate">{GAME_META[r.game].name}</h2>
            </div>
            {r.info ? (
              <CountdownBody info={r.info} now={now} />
            ) : r.loading ? (
              <Skeleton className="h-28" />
            ) : (
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                {r.error ? `${ERROR_TEXT[r.error.kind] ?? "Fehler"}: ${r.error.message}` : "Keine Versionsangaben gefunden"}
              </p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function CountdownBody({ info, now }: { info: VersionInfo; now: number }) {
  const accent = GAME_ACCENT[info.game];
  const parts = countdownParts(info.end.getTime() - now);
  return (
    <>
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="rounded-lg px-2 py-1" style={{ background: "var(--surface-2)" }}>
          Aktuell <strong>v{info.current}</strong>
        </span>
        <span aria-hidden style={{ color: "var(--muted)" }}>→</span>
        <span className="rounded-lg px-2 py-1" style={{ background: "var(--surface-2)" }}>
          Demnächst <strong style={{ color: accent }}>v{info.next}</strong>
          {info.nextGuessed && <span style={{ color: "var(--muted)" }}> (vermutet)</span>}
        </span>
      </div>
      {parts ? (
        <div className="grid grid-cols-4 gap-2" role="timer" aria-label={`Noch ${parts.map((p) => `${p.value} ${p.label}`).join(", ")}`}>
          {parts.map((p) => (
            <div key={p.label} className="rounded-xl py-2 text-center" style={{ background: "var(--surface-2)" }}>
              <div className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
                {String(p.value).padStart(2, "0")}
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{p.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl py-4 text-center font-semibold" style={{ background: "var(--surface-2)", color: accent }}>
          Update läuft – v{info.next} erscheint in Kürze
        </p>
      )}
      <div className="text-xs space-y-1" style={{ color: "var(--muted)" }}>
        <p>
          {info.endEstimated ? "Geschätzter Wartungsbeginn" : "Wartungsbeginn"}: {fmtDate(info.end)}
          {info.endEstimated && " (übliche Versionslänge, noch keine Ankündigung)"}
        </p>
        <p>
          Quelle:{" "}
          {info.sources.map((s, i) => (
            <span key={s.label}>
              {i > 0 && " · "}
              <ExternalLink url={s.url}>{s.label}</ExternalLink>
            </span>
          ))}
        </p>
      </div>
    </>
  );
}
