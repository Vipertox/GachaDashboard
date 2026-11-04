import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { btnGhost, btnPrimary, Card } from "../components/ui";

interface State {
  error?: Error;
}

/** Fängt Renderfehler einer Seite ab, damit nicht die ganze App weiß bleibt. */
class PageErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Renderfehler", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <Card>
        <div className="p-4 space-y-3" role="alert">
          <h2 className="font-semibold">Diese Seite konnte nicht angezeigt werden.</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {error.message}
          </p>
          <div className="flex gap-3">
            <button className={btnPrimary} onClick={() => location.reload()}>
              Neu laden
            </button>
            <Link to="/" className={btnGhost} style={{ background: "var(--surface-2)" }}>
              Zur Übersicht
            </Link>
          </div>
        </div>
      </Card>
    );
  }
}

/** Setzt den Fehlerzustand beim Seitenwechsel zurück, damit die Navigation weiter funktioniert. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <PageErrorBoundary key={pathname}>{children}</PageErrorBoundary>;
}
