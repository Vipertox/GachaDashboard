import { useEffect, useState } from "react";
import { btnGhost, btnPrimary } from "../../components/ui";
import { appVersion, canSelfUpdate, checkForUpdate, type AvailableUpdate } from "../../lib/updater";

function useInstall(update: AvailableUpdate | null) {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const install = async () => {
    if (!update) return;
    setInstalling(true);
    setError(null);
    try {
      await update.install();
    } catch (e) {
      setError(`Update fehlgeschlagen: ${String(e)}`);
      setInstalling(false);
    }
  };
  return { installing, error, install };
}

/** Hinweis oben im Fenster, wenn beim Start ein Update gefunden wurde. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const { installing, error, install } = useInstall(update);

  useEffect(() => {
    // Offline oder Server nicht erreichbar: beim Start still ignorieren
    checkForUpdate().then(setUpdate, () => setUpdate(null));
  }, []);

  if (!update || dismissed) return null;
  return (
    <div className="mb-4 rounded-xl p-3 text-sm space-y-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <p>Version {update.version} ist verfügbar.</p>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={installing} onClick={install}>
          {installing ? "Wird installiert …" : "Jetzt aktualisieren"}
        </button>
        <button className={btnGhost} disabled={installing} onClick={() => setDismissed(true)}>
          Später
        </button>
      </div>
    </div>
  );
}

/** Abschnitt in den Einstellungen: Version anzeigen und manuell nach Updates suchen. */
export function UpdateSection() {
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const { installing, error, install } = useInstall(update);

  useEffect(() => {
    appVersion().then(setVersion, () => setVersion(null));
  }, []);

  if (!canSelfUpdate()) return null;

  const check = async () => {
    setChecking(true);
    setStatus(null);
    try {
      const found = await checkForUpdate();
      setUpdate(found);
      setStatus(found ? `Version ${found.version} ist verfügbar.` : "Die App ist aktuell.");
    } catch (e) {
      setStatus(`Suche fehlgeschlagen: ${String(e)}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-sm" style={{ color: "var(--muted)" }}>
        Updates{version && ` · installiert: ${version}`}
      </span>
      <div className="flex gap-2">
        <button className={btnGhost} style={{ border: "1px solid var(--border)" }} disabled={checking || installing} onClick={check}>
          {checking ? "Suche …" : "Nach Updates suchen"}
        </button>
        {update && (
          <button className={btnPrimary} disabled={installing} onClick={install}>
            {installing ? "Wird installiert …" : "Installieren"}
          </button>
        )}
      </div>
      {status && <p className="text-sm">{status}</p>}
      {error && <p className="text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
