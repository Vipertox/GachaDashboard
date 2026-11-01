import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/state";
import { BottomSheet, btn, btnPrimary, Card } from "../../components/ui";
import { GAME_META } from "../../model/games";
import type { Profile } from "../../model/types";
import { ProfileEditor } from "./ProfileEditor";

export function Accounts() {
  const { profiles, activeProfile, setActive, deleteProfile } = useApp();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Profile | "new" | null>(params.get("new") ? "new" : null);
  // Eigene Bestätigung statt window.confirm, das die Android-WebView nicht zuverlässig anzeigt.
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [deleteError, setDeleteError] = useState<string>();

  const close = () => {
    setEditing(null);
    if (params.has("new")) setParams({});
  };

  if (editing) {
    return (
      <ProfileEditor
        profile={editing === "new" ? undefined : editing}
        onDone={(created) => {
          close();
          if (created) navigate("/");
        }}
        onCancel={close}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Konten</h1>
      {profiles.map((p) => (
        <Card key={p.id} accent={p.color}>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm" style={{ color: "var(--muted)" }}>
                  {p.games.length ? p.games.map((g) => GAME_META[g.game].name).join(", ") : "Keine Spiele"}
                </div>
              </div>
              {activeProfile?.id === p.id && (
                <span className="text-xs rounded-full px-2 py-1" style={{ background: "var(--surface-2)" }}>
                  Aktiv
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeProfile?.id !== p.id && (
                <button className={btn} style={{ background: "var(--surface-2)" }} onClick={() => setActive(p.id)}>
                  Aktivieren
                </button>
              )}
              <button className={btn} style={{ background: "var(--surface-2)" }} onClick={() => setEditing(p)}>
                Bearbeiten
              </button>
              <button
                className={btn}
                style={{ color: "var(--color-danger)" }}
                onClick={() => {
                  setDeleteError(undefined);
                  setDeleting(p);
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        </Card>
      ))}
      <button className={btnPrimary} onClick={() => setEditing("new")}>
        Profil anlegen
      </button>
      <BottomSheet open={!!deleting} onClose={() => setDeleting(null)} title="Profil löschen">
        <p className="mb-4">Profil „{deleting?.name}“ und seine Tokens löschen?</p>
        {deleteError && (
          <p className="mb-4 text-sm" style={{ color: "var(--color-danger)" }}>
            {deleteError}
          </p>
        )}
        <div className="flex gap-2">
          <button
            className={btn}
            style={{ background: "var(--color-danger)", color: "#fff" }}
            onClick={() => {
              if (!deleting) return;
              deleteProfile(deleting.id)
                .then(() => setDeleting(null))
                .catch((e) => setDeleteError(e instanceof Error ? e.message : String(e)));
            }}
          >
            Löschen
          </button>
          <button className={btn} style={{ background: "var(--surface-2)" }} onClick={() => setDeleting(null)}>
            Abbrechen
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
