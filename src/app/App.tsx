import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { Skeleton } from "../components/ui";
import { Dashboard } from "../features/dashboard/Dashboard";
import { UpdateBanner } from "../features/settings/Updates";
import { RouteErrorBoundary } from "./ErrorBoundary";
import { useApp } from "./state";

// Startseite direkt, die übrigen Seiten als eigene Chunks erst beim ersten Aufruf
const Accounts = lazy(() => import("../features/accounts/Accounts").then((m) => ({ default: m.Accounts })));
const CharacterView = lazy(() => import("../features/game-detail/CharacterView").then((m) => ({ default: m.CharacterView })));
const GameDetail = lazy(() => import("../features/game-detail/GameDetail").then((m) => ({ default: m.GameDetail })));
const Settings = lazy(() => import("../features/settings/Settings").then((m) => ({ default: m.Settings })));
const TimelinePage = lazy(() => import("../features/timeline/Timeline").then((m) => ({ default: m.TimelinePage })));

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
// Bewusst kein ARIA-Menü (role="menu" verspricht Pfeiltasten-Steuerung), sondern eine
// Disclosure aus normalen Buttons und Links: Tab-Reihenfolge wie gewohnt, Fokus wird geführt.
function Header() {
  const { activeProfile, profiles, setActive } = useApp();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    // Beim Öffnen auf den ersten Eintrag, damit Tastatur und Screenreader im Menü landen
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
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
            ref={triggerRef}
            className="min-h-11 max-w-[60vw] px-3 rounded-xl flex items-center gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            aria-expanded={open}
            aria-controls="profile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {activeProfile && <span className="w-3 h-3 rounded-full shrink-0" style={{ background: activeProfile.color }} />}
            <span className="truncate">{activeProfile?.name ?? "Menü"}</span>
            <span aria-hidden>▾</span>
          </button>
          {open && (
            <>
              {/* Nur für Maus und Touch; Tastatur schließt mit Escape oder durch Verlassen des Menüs */}
              <button
                className="fixed inset-0 z-40 bg-black/50 md:bg-transparent cursor-default"
                tabIndex={-1}
                aria-hidden
                onClick={close}
              />
              <div
                ref={panelRef}
                id="profile-menu"
                aria-label="Profilmenü"
                onBlur={(e) => {
                  // Wandert der Fokus aus dem Menü hinaus (Tab), schließt es
                  if (!e.currentTarget.contains(e.relatedTarget)) close();
                }}
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
                            aria-pressed={p.id === activeProfile?.id}
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
                <NavLink to="/accounts" className={link} style={linkStyle} onClick={close}>
                  <UsersIcon />
                  Konten verwalten
                </NavLink>
                <NavLink to="/settings" className={link} style={linkStyle} onClick={close}>
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
        <RouteErrorBoundary>
          <Suspense fallback={<Skeleton className="h-40" />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/game/:game/:uid" element={<GameDetail />} />
            <Route path="/game/:game/:uid/figur/:id" element={<CharacterView />} />
            <Route path="/zeitleiste" element={<TimelinePage />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <Nav />
    </HashRouter>
  );
}
