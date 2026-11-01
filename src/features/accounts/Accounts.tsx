import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../app/state";
import { btn, btnPrimary, Card } from "../../components/ui";
import { GAME_META } from "../../model/games";
import type { Profile } from "../../model/types";
import { ProfileEditor } from "./ProfileEditor";

export function Accounts() {
  const { profiles, activeProfile, setActive, deleteProfile } = useApp();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Profile | "new" | null>(params.get("new") ? "new" : null);

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
                  if (confirm(`Profil „${p.name}“ und seine Tokens löschen?`)) void deleteProfile(p.id);
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
    </div>
  );
}
