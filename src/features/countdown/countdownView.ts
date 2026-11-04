export interface CountdownPart {
  value: number;
  label: string;
}

/** Restzeit zerlegt in Tage, Stunden, Minuten, Sekunden; abgelaufen ergibt `undefined`. */
export function countdownParts(ms: number): CountdownPart[] | undefined {
  if (ms <= 0) return undefined;
  const s = Math.floor(ms / 1000);
  return [
    { value: Math.floor(s / 86400), label: "Tage" },
    { value: Math.floor((s % 86400) / 3600), label: "Std" },
    { value: Math.floor((s % 3600) / 60), label: "Min" },
    { value: s % 60, label: "Sek" },
  ];
}
