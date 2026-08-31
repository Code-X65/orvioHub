import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resolveHost, UnknownHostError, type ApplicationKey } from "@orviohub/shared";
import { HostProvider } from "./host/HostProvider";
import { UnknownHostScreen } from "./host/UnknownHostScreen";
import { Toaster } from "./components/ui/sonner";
import { initObservability } from "./lib/observability";
import { useAuthStore } from "./stores/useAuthStore";
import "./index.css";

// 1. Auto-redirect localhost / 127.0.0.1 directly to the appropriate subdomain
if (
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
) {
  const port = window.location.port ? `:${window.location.port}` : "";
  const pathname = window.location.pathname.toLowerCase();

  let targetHost = "orviohub.localhost";
  if (
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/confirm-email-change") ||
    pathname.startsWith("/invitations") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/profile")
  ) {
    targetHost = "accounts.orviohub.localhost";
  } else if (pathname.startsWith("/app") || pathname.startsWith("/launcher") || pathname.startsWith("/onboarding") || pathname.startsWith("/welcome")) {
    targetHost = "app.orviohub.localhost";
  } else if (pathname.startsWith("/inventory")) {
    targetHost = "inventory.orviohub.localhost";
  } else if (pathname.startsWith("/taskmanagement") || pathname.startsWith("/tasks")) {
    targetHost = "tasks.orviohub.localhost";
  } else if (pathname.startsWith("/dashboard") || pathname.startsWith("/home")) {
    targetHost = "home.orviohub.localhost";
  }

  window.location.replace(
    `http://${targetHost}${port}${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}

initObservability();
useAuthStore.getState().refreshSession();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const surfaces: Record<ApplicationKey, React.LazyExoticComponent<React.ComponentType>> = {
  marketing: lazy(() => import("./surfaces/marketing/App")),
  accounts: lazy(() => import("./surfaces/accounts/App")),
  home: lazy(() => import("./surfaces/home/App")),
  launcher: lazy(() => import("./surfaces/launcher/App")),
  inventory: lazy(() => import("./surfaces/inventory/App")),
  taskmanagement: lazy(() => import("./surfaces/taskmanagement/App")),
};

const SurfaceLoading = () => (
  <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-3 text-slate-400 font-sans">
    <div className="w-8 h-8 rounded-full border-2 border-[#714b67]/20 border-t-[#714b67] animate-spin" />
    <p className="text-[11px] uppercase tracking-widest text-slate-500 font-medium">Loading Surface...</p>
  </div>
);

const root = createRoot(document.getElementById("root")!);

try {
  const host = resolveHost(window.location.host, window.location.pathname);
  const Surface = surfaces[host.application];

  root.render(
    <StrictMode>
      <HostProvider value={host}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Suspense fallback={<SurfaceLoading />}>
              <Surface />
            </Suspense>
            <Toaster />
          </BrowserRouter>
        </QueryClientProvider>
      </HostProvider>
    </StrictMode>
  );
} catch (error) {
  if (error instanceof UnknownHostError) {
    root.render(<UnknownHostScreen hostname={error.hostname} />);
  } else {
    throw error;
  }
}
