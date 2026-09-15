import { lazy, Suspense } from "react";
import { useHost } from "./host/useHost";
import { useSessionTracker } from "./hooks/useSessionTracker";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

const MarketingApp = lazy(() => import("./surfaces/marketing/App"));
const AccountsApp = lazy(() => import("./surfaces/accounts/App"));
const HomeApp = lazy(() => import("./surfaces/home/App"));
const LauncherApp = lazy(() => import("./surfaces/launcher/App"));
const InventoryApp = lazy(() => import("./surfaces/inventory/App"));
const TaskManagementApp = lazy(() => import("./surfaces/taskmanagement/App"));
const FallbackRoutes = lazy(() => import("./FallbackRoutes"));

function SurfaceFallback() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#714b67] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function App() {
  useSessionTracker();
  const host = useHost();

  const renderSurface = () => {
    switch (host.application) {
      case "marketing":
        return <MarketingApp />;
      case "accounts":
        return <AccountsApp />;
      case "home":
        return <HomeApp />;
      case "launcher":
        return <LauncherApp />;
      case "inventory":
        return <InventoryApp />;
      case "taskmanagement":
        return <TaskManagementApp />;
      default:
        return <FallbackRoutes />;
    }
  };

  return (
    <ErrorBoundary>
      <Suspense fallback={<SurfaceFallback />}>
        {renderSurface()}
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;

