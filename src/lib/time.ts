import type { Resource } from "../model/types";

export function secondsFromNow(seconds: number, now = new Date()): Date {
  return new Date(now.getTime() + seconds * 1000);
}

/** Aktueller Stand, lokal aus `fullAt` weitergerechnet. */
export function liveValue(r: Resource, now: number): number {
  if (!r.fullAt || r.current >= r.max) return r.current;
  const remainingMs = r.fullAt.getTime() - now;
  if (remainingMs <= 0) return r.max;
  const regenMs = (r.regenSeconds ?? 0) * 1000;
  if (!regenMs) return r.current;
  const missing = Math.ceil(remainingMs / regenMs);
  return Math.min(r.max, Math.max(r.current, r.max - missing));
}

export function isFull(r: Resource, now: number): boolean {
  return liveValue(r, now) >= r.max;
}

export function fraction(r: Resource, now: number): number {
  return r.max > 0 ? Math.min(1, liveValue(r, now) / r.max) : 0;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "0 min";
  const totalMin = Math.ceil(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} T ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Fertig";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d} T ${h} h`;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function formatClock(date: Date, now: number): string {
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const sameDay = new Date(now).toDateString() === date.toDateString();
  if (sameDay) return time;
  // Kalendertag statt +24 h: am Tag der Zeitumstellung hat der Tag 23 oder 25 Stunden
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  const tomorrow = next.toDateString() === date.toDateString();
  if (tomorrow) return `morgen ${time}`;
  return `${date.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })} ${time}`;
}
