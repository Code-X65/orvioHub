import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resolveHost, UnknownHostError } from "@orviohub/shared";
import { HostProvider } from "./host/HostProvider";
import { UnknownHostScreen } from "./host/UnknownHostScreen";
import { Toaster } from "./components/ui/sonner";
import { initObservability } from "./lib/observability";
import { useAuthStore } from "./stores/useAuthStore";
import { App } from "./App";
import "./index.css";

initObservability();
// Defer session validation so the UI paints immediately.
// The AuthGuard will still trigger validation on first mount if needed.
if (typeof window !== 'undefined') {
  const bootstrapAuth = () => {
    if (!useAuthStore.getState().isInitialized) {
      useAuthStore.getState().refreshSession();
    }
  };
  // Use requestIdleCallback for non-critical bootstrap work
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(bootstrapAuth, { timeout: 3000 });
  } else {
    setTimeout(bootstrapAuth, 1000);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const root = createRoot(document.getElementById("root")!);

try {
  const initialHost = resolveHost(window.location.host, window.location.pathname);

  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <HostProvider initialValue={initialHost}>
            <App />
            <Toaster />
          </HostProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>
  );
} catch (error) {
  if (error instanceof UnknownHostError) {
    root.render(<UnknownHostScreen hostname={error.hostname} />);
  } else {
    throw error;
  }
}
