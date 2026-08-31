import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "../../components/auth/AuthGuard";
import { AppProductLanding } from "../../pages/products/AppProductLanding";
import { InventoryDashboard } from "../../pages/inventory/InventoryDashboard";
import { InventoryOnboarding } from "../../pages/inventory/InventoryOnboarding";
import { OrganizationSettings } from "../../pages/settings/OrganizationSettings";
import { AcceptInvite } from "../../pages/auth/AcceptInvite";

import { useAuthStore } from "../../stores/useAuthStore";

const InventoryRoot = () => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) {
    return <InventoryDashboard />;
  }
  return <AppProductLanding />;
};

export default function InventoryApp() {
  return (
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />
      
      {/* Root Route: Dashboard if authenticated, Showcase if guest */}
      <Route path="/" element={<InventoryRoot />} />
      <Route path="/preview" element={<AppProductLanding />} />

      {/* 2. Authenticated Application Dashboard & Operations */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <InventoryDashboard />
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard"
        element={
          <AuthGuard>
            <InventoryDashboard />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding"
        element={
          <AuthGuard>
            <InventoryOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <OrganizationSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/organization/settings"
        element={
          <AuthGuard>
            <OrganizationSettings />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
