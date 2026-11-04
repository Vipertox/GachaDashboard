import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { imageFor } from "../assets/registry";
import { fraction, isFull, liveValue } from "../lib/time";
import type { Resource } from "../model/types";

/** Spiel-, Ressourcen- oder Figurenbild; eine Datei zum Schlüssel geht vor der URL, ohne beides ein neutrales Ersatzsymbol. */
export function GameIcon({
  iconKey,
  url,
  size = 40,
  round = false,
  label,
}: {
  iconKey?: string;
  url?: string;
  size?: number;
  round?: boolean;
  label?: string;
}) {
  const src = (iconKey ? imageFor(iconKey) : undefined) ?? url;
  const style = { width: size, height: size };
  const shape = round ? "rounded-full" : "rounded-xl";
  if (src) {
    return <img src={src} alt="" style={style} className={`${shape} object-cover shrink-0`} loading="lazy" referrerPolicy="no-referrer" />;
  }
  return (
    <span
      style={{ ...style, fontSize: size * 0.4 }}
      className={`${shape} shrink-0 flex items-center justify-center font-semibold`}
      aria-hidden
    >
      <span
        className={`${shape} w-full h-full flex items-center justify-center`}
        style={{ background: "var(--surface-2)", color: "var(--muted)" }}
      >
        {(label ?? iconKey ?? "?").trim().charAt(0).toUpperCase()}
      </span>
    </span>
  );
}

/**
 * "overflow": regenerierende Ressource, voll heißt Verlust (Warnfarbe ab 90 %, Rot bei voll).
 * "progress": Aufgabe oder Wochenfortschritt, voll heißt erledigt (Grün).
 */
export type BarMode = "overflow" | "progress";

/**
 * Hintergrund für Kartenkopf und Detailkopf: abgedunkeltes Spiel-Artwork (lokale Datei, sonst
 * `url` aus der API), ohne Bild ein Verlauf in der Akzentfarbe. Mit Artwork steht der Text immer hell.
 */
export function artworkStyle(artworkKey: string, accent: string, angle = 90, url?: string): CSSProperties {
  const art = imageFor(artworkKey) ?? url;
  if (art) {
    return {
      backgroundImage: `linear-gradient(${angle}deg, rgba(0,0,0,0.75), rgba(0,0,0,0.35)), url("${art}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      color: "#fff",
      "--muted": "rgba(255,255,255,0.75)",
    } as CSSProperties;
  }
  return { background: `linear-gradient(${angle}deg, color-mix(in srgb, ${accent} 30%, var(--surface)), var(--surface))` };
}

export function barColor(frac: number, accent: string, mode: BarMode = "overflow"): string {
  if (mode === "progress") return frac >= 1 ? "var(--color-ok)" : accent;
  if (frac >= 1) return "var(--color-danger)";
  if (frac >= 0.9) return "var(--color-warn)";
  return accent;
}

export function ProgressBar({
  frac,
  accent,
  height = 10,
  mode = "overflow",
}: {
  frac: number;
  accent: string;
  height?: number;
  mode?: BarMode;
}) {
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, background: "var(--surface-2)" }}
      role="progressbar"
      aria-valuenow={Math.round(frac * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="bar-fill h-full rounded-full" style={{ width: `${frac * 100}%`, background: barColor(frac, accent, mode) }} />
    </div>
  );
}

export function ResourceBar({ r, now, accent, mode }: { r: Resource; now: number; accent: string; mode?: BarMode }) {
  return <ProgressBar frac={fraction(r, now)} accent={accent} mode={mode} />;
}

export function Ring({ frac, accent, size = 88, children }: { frac: number; accent: string; size?: number; children?: ReactNode }) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={barColor(frac, accent)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          className="ring-fill"
          style={{ "--circ": circ } as CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function OverflowDot({ r, now }: { r: Resource; now: number }) {
  if (!isFull(r, now)) return null;
  return <span className="pulse-dot inline-block w-2 h-2 rounded-full" style={{ background: "var(--color-danger)" }} aria-label="läuft über" />;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Zählt beim ersten Anzeigen kurz von 0 auf den Zielwert hoch und folgt ihm danach direkt. */
export function useCountUp(target: number, ms = 600): number {
  const [skip] = useState(reducedMotion);
  const [progress, setProgress] = useState(skip ? 1 : 0);
  // Fortschritt kommt aus dem Animationsframe, nicht aus einer Zeitmessung beim Rendern.
  useEffect(() => {
    if (skip) return;
    const start = performance.now();
    const animation = { frame: 0 };
    const tick = (now: number) => {
      const next = Math.min(1, (now - start) / ms);
      setProgress(next);
      if (next < 1) animation.frame = requestAnimationFrame(tick);
    };
    animation.frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation.frame);
  }, [skip, ms]);
  return progress >= 1 ? target : Math.round(target * (1 - (1 - progress) ** 3));
}

export function ValueText({ r, now, className = "" }: { r: Resource; now: number; className?: string }) {
  const value = useCountUp(liveValue(r, now));
  return (
    <span className={className}>
      {value}
      <span style={{ color: "var(--muted)" }}> / {r.max}</span>
    </span>
  );
}

export function Chip({ done, iconKey, children }: { done: boolean; iconKey?: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 text-sm min-h-8"
      style={{
        background: done ? "color-mix(in srgb, var(--color-ok) 22%, transparent)" : "var(--surface-2)",
        color: done ? "var(--color-ok)" : "var(--text)",
      }}
    >
      {done ? <span aria-hidden>✓</span> : iconKey && imageFor(iconKey) && <GameIcon iconKey={iconKey} size={18} round />}
      {children}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function Card({ children, accent, className = "" }: { children: ReactNode; accent?: string; className?: string }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: accent ? `4px solid ${accent}` : undefined }}
    >
      {children}
    </div>
  );
}

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end" role="dialog" aria-modal aria-label={title}>
      <button className="absolute inset-0 bg-black/50" aria-label="Schließen" onClick={onClose} />
      <div
        className="sheet relative w-full max-w-xl mx-auto rounded-t-3xl p-4 safe-bottom"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: "var(--border)" }} />
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const btn =
  "min-h-11 min-w-11 px-4 rounded-xl font-medium inline-flex items-center justify-center gap-2 active:opacity-70 disabled:opacity-40";
export const btnPrimary = `${btn} bg-indigo-500 text-white`;
export const btnGhost = `${btn}`;
export const fieldCls = "w-full min-h-11 rounded-xl px-3 outline-none focus:ring-2 focus:ring-indigo-400";
export const fieldStyle = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" };
