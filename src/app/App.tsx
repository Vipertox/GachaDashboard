import { useState } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { Accounts } from "../features/accounts/Accounts";
import { Dashboard } from "../features/dashboard/Dashboard";
import { GameDetail } from "../features/game-detail/GameDetail";
import { Settings } from "../features/settings/Settings";
import { UpdateBanner } from "../features/settings/Updates";
import { BottomSheet } from "../components/ui";
import { useApp } from "./state";

function Header() {
  const { activeProfile, profiles, setActive } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <header className="safe-top sticky top-0 z-30" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
      <div className="max-w-5xl mx-auto px-4 min-h-14 flex items-center justify-between">
        <span className="font-bold">Gacha Dashboard</span>
        {activeProfile && (
          <button
            className="min-h-11 px-3 rounded-xl flex items-center gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={() => setOpen(true)}
          >
            <span className="w-3 h-3 rounded-full" style={{ background: activeProfile.color }} />
            {activeProfile.name} ▾
          </button>
        )}
      </div>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Profil wechseln">
        <ul className="space-y-2">
          {profiles.map((p) => (
            <li key={p.id}>
              <button
                className="w-full min-h-12 px-3 rounded-xl flex items-center gap-3 text-left"
                style={{ background: p.id === activeProfile?.id ? "var(--surface-2)" : "transparent" }}
                onClick={() => {
                  setActive(p.id);
                  setOpen(false);
                }}
              >
                <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                <span className="flex-1">{p.name}</span>
                {p.id === activeProfile?.id && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </header>
  );
}

function Nav() {
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex-1 min-h-14 flex items-center justify-center text-sm font-medium ${isActive ? "text-indigo-400" : ""}`;
  return (
    <nav
      className="safe-bottom fixed bottom-0 inset-x-0 z-30"
      style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
    >
      <div className="max-w-5xl mx-auto flex">
        <NavLink to="/" end className={item}>Dashboard</NavLink>
        <NavLink to="/accounts" className={item}>Konten</NavLink>
        <NavLink to="/settings" className={item}>Einstellungen</NavLink>
      </div>
    </nav>
  );
}

export function App() {
  const { ready, loadError } = useApp();
  if (!ready) return <p className="p-6" style={{ color: "var(--muted)" }}>Lade …</p>;
  return (
    <HashRouter>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-4 pb-28">
        <UpdateBanner />
        {loadError && (
          <p className="mb-4 rounded-xl p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--color-danger)" }}>
            {loadError}
          </p>
        )}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/game/:game/:uid" element={<GameDetail />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <Nav />
    </HashRouter>
  );
}
