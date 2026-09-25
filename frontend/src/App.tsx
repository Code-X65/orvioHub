import { lazy, Suspense, useMemo, useState, useEffect, useRef } from "react";
import { useHost } from "./host/useHost";
import { useSessionTracker } from "./hooks/useSessionTracker";
import { useRealtimeNotifications } from "./hooks/useRealtimeNotifications";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { OfflineBanner } from "./components/common/OfflineBanner";
import { TokenRefreshIndicator } from "./components/common/TokenRefreshIndicator";
import { SessionExpiryModal } from "./components/auth/SessionExpiryModal";
import { GoogleOneTap } from "./components/auth/GoogleOneTap";
import { areCookiesEnabled } from "./lib/cookieStorage";
import { useAuthStore } from "./stores/useAuthStore";
import { useCrossTabSync } from "./hooks/useCrossTabSync";
import { realtimeClient } from "./lib/realtimeClient";

const MarketingApp = lazy(() => import("./surfaces/marketing/App"));
const AccountsApp = lazy(() => import("./surfaces/accounts/App"));
const HomeApp = lazy(() => import("./surfaces/home/App"));
const LauncherApp = lazy(() => import("./surfaces/launcher/App"));
const InventoryApp = lazy(() => import("./surfaces/inventory/App"));
const TaskManagementApp = lazy(() => import("./surfaces/taskmanagement/App"));
const FallbackRoutes = lazy(() => import("./FallbackRoutes"));

/**
 * Headless background effect managers.
 * Only activated when the user is authenticated, avoiding useless overhead on guest pages.
 */
function SessionTrackerInner() {
  useSessionTracker();
  return null;
}

function SessionTrackerManager() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return null;
  return <SessionTrackerInner />;
}

function RealtimeNotificationInner() {
  useRealtimeNotifications();
  return null;
}

function RealtimeNotificationManager() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  useCrossTabSync();

  useEffect(() => {
    if (isAuthenticated) {
      realtimeClient.connect({ userId: user?.id || user?._id });
    } else {
      realtimeClient.disconnect();
    }
    return () => {
      realtimeClient.disconnect();
    };
  }, [isAuthenticated, user?.id, user?._id]);

  if (!isAuthenticated) return null;
  return <RealtimeNotificationInner />;
}

function CookieDisabledWarning() {
  const [disabled, setDisabled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!areCookiesEnabled()) {
      setDisabled(true);
    }
  }, []);

  if (!disabled || dismissed) return null;

  return (
    <div className="fixed bottom-3 right-3 z-50 max-w-sm p-3 rounded bg-amber-950/95 border border-amber-500/40 text-amber-100 text-xs shadow-xl flex items-start justify-between gap-3 animate-in fade-in duration-300">
      <div>
        <p className="font-semibold text-white">Cookies appear to be disabled</p>
        <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
          Your browser privacy settings prevent cookie storage. Some cross-subdomain features may require enabling cookies for the best experience.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-white text-sm font-bold px-1.5 py-0.5 cursor-pointer"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

function SurfaceLoadingFallback() {
  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col items-center justify-center">
      <div className="w-7 h-7 border-2 border-[#714b67] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function App() {
  const host = useHost();
  const surfaceCache = useRef<Map<string, React.ReactNode>>(new Map());

  const surface = useMemo(() => {
    const cached = surfaceCache.current.get(host.application);
    if (cached) return cached;

    let element: React.ReactNode;
    switch (host.application) {
      case "marketing":
        element = <MarketingApp />;
        break;
      case "accounts":
        element = <AccountsApp />;
        break;
      case "home":
        element = <HomeApp />;
        break;
      case "launcher":
        element = <LauncherApp />;
        break;
      case "inventory":
        element = <InventoryApp />;
        break;
      case "taskmanagement":
        element = <TaskManagementApp />;
        break;
      default:
        element = <FallbackRoutes />;
        break;
    }
    surfaceCache.current.set(host.application, element);
    return element;
  }, [host.application]);

  useEffect(() => {
    const preloadSurfaces = () => {
      const surfacesToPreload = ['inventory', 'launcher', 'taskmanagement'];
      const currentSurface = host.application;

      surfacesToPreload.forEach((surface) => {
        if (surface === currentSurface) return;
        // Preload the chunk but don't render yet
        switch (surface) {
          case 'inventory':
            import('./surfaces/inventory/App');
            break;
          case 'launcher':
            import('./surfaces/launcher/App');
            break;
          case 'taskmanagement':
            import('./surfaces/taskmanagement/App');
            break;
        }
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(preloadSurfaces, { timeout: 5000 });
    } else {
      setTimeout(preloadSurfaces, 3000);
    }
  }, [host.application]);

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <TokenRefreshIndicator />
      <SessionExpiryModal />
      <SessionTrackerManager />
      <RealtimeNotificationManager />
      <GoogleOneTap />
      <CookieDisabledWarning />
      <Suspense fallback={<SurfaceLoadingFallback />}>
        {surface}
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;

