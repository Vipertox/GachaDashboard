import { useEffect, useState } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { Accounts } from "../features/accounts/Accounts";
import { Dashboard } from "../features/dashboard/Dashboard";
import { CharacterView } from "../features/game-detail/CharacterView";
import { GameDetail } from "../features/game-detail/GameDetail";
import { Settings } from "../features/settings/Settings";
import { TimelinePage } from "../features/timeline/Timeline";
import { UpdateBanner } from "../features/settings/Updates";
import { useApp } from "./state";

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// Profilmenü mit Profilwechsel, Konten und Einstellungen:
// auf dem Smartphone als Bottom Sheet, ab md als Dropdown unter dem Button
function Header() {
  const { activeProfile, profiles, setActive } = useApp();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const link = ({ isActive }: { isActive: boolean }) =>
    `w-full min-h-12 px-3 rounded-xl flex items-center gap-3 ${isActive ? "text-indigo-400" : ""}`;
  const linkStyle = ({ isActive }: { isActive: boolean }) => ({ background: isActive ? "var(--surface-2)" : "transparent" });

  return (
    <header className="safe-top sticky top-0 z-40" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
      <div className="max-w-5xl mx-auto px-4 min-h-14 flex items-center justify-between gap-3">
        <span className="font-bold truncate">Gacha Dashboard</span>
        <div className="relative shrink-0">
          <button
            className="min-h-11 max-w-[60vw] px-3 rounded-xl flex items-center gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {activeProfile && <span className="w-3 h-3 rounded-full shrink-0" style={{ background: activeProfile.color }} />}
            <span className="truncate">{activeProfile?.name ?? "Menü"}</span>
            <span aria-hidden>▾</span>
          </button>
          {open && (
            <>
              <button className="fixed inset-0 z-40 bg-black/50 md:bg-transparent cursor-default" aria-label="Schließen" onClick={close} />
              <div
                role="menu"
                aria-label="Profilmenü"
                className="menu-panel fixed inset-x-0 bottom-0 z-50 w-full max-w-xl mx-auto rounded-t-3xl p-4 safe-bottom md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-72 md:rounded-2xl md:p-2 md:shadow-xl"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="md:hidden mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: "var(--border)" }} />
                {profiles.length > 0 && (
                  <>
                    <h2
                      className="text-lg font-semibold mb-3 md:text-xs md:font-medium md:uppercase md:tracking-wide md:mb-1 md:px-3 md:pt-1"
                      style={{ color: "var(--muted)" }}
                    >
                      Profil
                    </h2>
                    <ul className="space-y-1">
                      {profiles.map((p) => (
                        <li key={p.id}>
                          <button
                            role="menuitemradio"
                            aria-checked={p.id === activeProfile?.id}
                            className="w-full min-h-12 px-3 rounded-xl flex items-center gap-3 text-left"
                            style={{ background: p.id === activeProfile?.id ? "var(--surface-2)" : "transparent" }}
                            onClick={() => {
                              setActive(p.id);
                              close();
                            }}
                          >
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                            <span className="flex-1 truncate">{p.name}</span>
                            {p.id === activeProfile?.id && <span aria-hidden>✓</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <hr className="my-2" style={{ borderColor: "var(--border)" }} />
                  </>
                )}
                <NavLink to="/accounts" role="menuitem" className={link} style={linkStyle} onClick={close}>
                  <UsersIcon />
                  Konten verwalten
                </NavLink>
                <NavLink to="/settings" role="menuitem" className={link} style={linkStyle} onClick={close}>
                  <GearIcon />
                  Einstellungen
                </NavLink>
              </div>
            </>
          )}
        </div>
      </div>
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
        <NavLink to="/zeitleiste" className={item}>Zeitleiste</NavLink>
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
          <Route path="/game/:game/:uid/figur/:id" element={<CharacterView />} />
          <Route path="/zeitleiste" element={<TimelinePage />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <Nav />
    </HashRouter>
  );
}
