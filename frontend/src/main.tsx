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

const SurfaceSkeleton = () => (
  <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between">
    {/* Header Skeleton Bar */}
    <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-xl border-b border-white/5 h-20 flex items-center justify-between px-6 sm:px-8 lg:px-12 max-w-[1520px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
        <div className="w-20 h-5 rounded-xs bg-white/10 animate-pulse" />
      </div>
      <div className="hidden lg:flex items-center gap-6">
        <div className="w-16 h-4 rounded-xs bg-white/10 animate-pulse" />
        <div className="w-20 h-4 rounded-xs bg-white/10 animate-pulse" />
        <div className="w-16 h-4 rounded-xs bg-white/10 animate-pulse" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-20 h-8 rounded-xs bg-white/10 animate-pulse" />
      </div>
    </header>

    {/* Hero & Content Skeleton */}
    <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="text-center max-w-2xl mx-auto space-y-4 pt-6">
        <div className="w-36 h-6 rounded-xs bg-[#714b67]/20 border border-[#714b67]/30 mx-auto animate-pulse" />
        <div className="w-3/4 h-10 rounded-xs bg-white/10 mx-auto animate-pulse" />
        <div className="w-1/2 h-4 rounded-xs bg-white/5 mx-auto animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-6 rounded-xs border border-white/10 bg-[#120b10] space-y-4 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xs bg-white/10" />
              <div className="w-20 h-5 rounded-xs bg-white/10" />
            </div>
            <div className="w-3/4 h-5 rounded-xs bg-white/10" />
            <div className="w-full h-3.5 rounded-xs bg-white/5" />
            <div className="w-5/6 h-3.5 rounded-xs bg-white/5" />
            <div className="pt-4 border-t border-white/5 flex gap-2">
              <div className="flex-1 h-9 rounded-xs bg-[#714b67]/30" />
              <div className="flex-1 h-9 rounded-xs bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </main>

    <footer className="w-full border-t border-white/5 bg-black py-6 text-center text-xs text-slate-600">
      Loading surface...
    </footer>
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
            <Suspense fallback={<SurfaceSkeleton />}>
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
