export type ApiErrorKind =
  | "auth" // Token abgelaufen oder ungültig
  | "notes_disabled" // Echtzeit-Notizen in HoYoLAB nicht freigegeben
  | "rate_limit"
  | "retry" // Kuro: Daten noch nicht bereit
  | "network"
  | "schema" // Antwort passt nicht zum erwarteten Schema
  | "missing_credentials"
  | "unknown";

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public code?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const ERROR_TEXT: Record<ApiErrorKind, string> = {
  auth: "Neu anmelden",
  notes_disabled: "Echtzeit-Notizen in HoYoLAB aktivieren",
  rate_limit: "Zu viele Anfragen, später erneut versuchen",
  retry: "Daten noch nicht bereit",
  network: "Keine Verbindung",
  schema: "Schnittstelle geändert",
  missing_credentials: "Zugangsdaten fehlen",
  unknown: "Unbekannter Fehler",
};
