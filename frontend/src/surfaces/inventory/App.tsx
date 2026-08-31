import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "../../components/auth/AuthGuard";
import { AppProductLanding } from "../../pages/products/AppProductLanding";
import { InventoryDashboard } from "../../pages/inventory/InventoryDashboard";
import { InventoryOnboarding } from "../../pages/inventory/InventoryOnboarding";
import { OrganizationSettings } from "../../pages/settings/OrganizationSettings";
import { AcceptInvite } from "../../pages/auth/AcceptInvite";

export default function InventoryApp() {
  return (
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />
      
      {/* 1. Public Inventory Landing & Feature Showcase */}
      <Route path="/" element={<AppProductLanding />} />
      <Route path="/preview" element={<AppProductLanding />} />
      <Route path="/overview" element={<AppProductLanding />} />
      <Route path="/features" element={<AppProductLanding />} />

      {/* 2. Authenticated Application Dashboard & Operations (Strictly Guarded) */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <InventoryDashboard />
          </AuthGuard>
        }
      />
      <Route
        path="/dashboard/*"
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
