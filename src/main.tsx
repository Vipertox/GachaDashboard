import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AppProvider } from "./app/state";
import "./index.css";

// Spieldaten bleiben nur im Arbeitsspeicher: kein Persistieren des Query-Caches.
const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 10 * 60_000 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <App />
      </AppProvider>
    </QueryClientProvider>
  </StrictMode>,
);
