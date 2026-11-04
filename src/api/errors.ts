export type ApiErrorKind =
  | "auth" // Token abgelaufen oder ungültig
  | "notes_disabled" // Echtzeit-Notizen in HoYoLAB nicht freigegeben
  | "rate_limit"
  | "maintenance" // Spiel-Update: HoYoLAB liefert während der Wartung keine Daten
  | "retry" // Kuro: Daten noch nicht bereit
  | "network"
  | "schema" // Antwort passt nicht zum erwarteten Schema
  | "missing_credentials"
  | "unknown";

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly code?: number,
    /** Ursprünglicher Fehler, z. B. aus fetch; bleibt in der Konsole nachvollziehbar. */
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

export const ERROR_TEXT: Record<ApiErrorKind, string> = {
  auth: "Neu anmelden",
  notes_disabled: "Echtzeit-Notizen in HoYoLAB aktivieren",
  rate_limit: "Zu viele Anfragen, später erneut versuchen",
  maintenance: "Wartung, Server gerade nicht erreichbar",
  retry: "Daten noch nicht bereit",
  network: "Keine Verbindung",
  schema: "Schnittstelle geändert",
  missing_credentials: "Zugangsdaten fehlen",
  unknown: "Unbekannter Fehler",
};
