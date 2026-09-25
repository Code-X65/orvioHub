import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "../../components/auth/AuthGuard";
import { HomePage } from "./pages/HomePage";
import { WorkplacePage } from "./pages/WorkplacePage";
import { WorkspaceSettingsPage } from "../../pages/settings/WorkspaceSettingsPage";
import { BranchSettingsPage } from "../../pages/settings/BranchSettingsPage";
import { InventorySettingsPage } from "../../pages/settings/InventorySettingsPage";
import { WorkspaceMembers } from "../../pages/settings/WorkspaceMembers";
import { WorkspaceDangerZone } from "../../pages/workspaces/WorkspaceDangerZone";
import { WorkspaceInvitationsPage } from "../../pages/workspaces/WorkspaceInvitationsPage";
import { ProfileSettings } from "../../pages/settings/ProfileSettings";
import { AcceptInvite } from "../../pages/auth/AcceptInvite";

import { BillingSettingsPage } from "../../pages/billing/BillingSettingsPage";
import { PaymentPage } from "../../pages/billing/PaymentPage";
import { InvoiceDetailPage } from "../../pages/billing/InvoiceDetailPage";
import { UsagePage } from "../../pages/billing/UsagePage";
import { AppActivationPage } from "../../pages/apps/AppActivationPage";
import { BranchSetupPage } from "../../pages/apps/BranchSetupPage";
import { OrganizationWizard } from "../../pages/onboarding/OrganizationWizard";
import { PersonalOnboarding } from "../../pages/onboarding/PersonalOnboarding";
import { useAuthStore } from "@/stores/useAuthStore";

function OnboardRouteDispatcher() {
  const { user } = useAuthStore();
  if (!user?.personalOnboardingCompleted) {
    return <Navigate to="/onboard/personal" replace />;
  }
  return <Navigate to="/onboard/organization" replace />;
}

export default function HomeApp() {
  return (
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />

      {/* Two-Layer Onboarding: Personal Onboarding + Organization Onboarding & Billing */}
      <Route
        path="/onboard/personal"
        element={
          <AuthGuard>
            <PersonalOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/organization"
        element={
          <AuthGuard>
            <OrganizationWizard />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/billing"
        element={
          <AuthGuard>
            <OrganizationWizard />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/payment"
        element={
          <AuthGuard>
            <PaymentPage />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard"
        element={
          <AuthGuard>
            <OnboardRouteDispatcher />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding"
        element={
          <AuthGuard>
            <OnboardRouteDispatcher />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/personal"
        element={
          <AuthGuard>
            <PersonalOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/organization"
        element={
          <AuthGuard>
            <OrganizationWizard />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/billing"
        element={
          <AuthGuard>
            <OrganizationWizard />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/payment"
        element={
          <AuthGuard>
            <PaymentPage />
          </AuthGuard>
        }
      />
      <Route
        path="/payment"
        element={
          <AuthGuard>
            <PaymentPage />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/*"
        element={
          <AuthGuard>
            <OnboardRouteDispatcher />
          </AuthGuard>
        }
      />
      <Route
        path="/workspaces/new"
        element={
          <AuthGuard>
            <OrganizationWizard />
          </AuthGuard>
        }
      />
      <Route
        path="/organizations/new"
        element={
          <AuthGuard>
            <OrganizationWizard />
          </AuthGuard>
        }
      />

      {/* 1. Organization Level: /dashboard and / (shows organizations for user to select) */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <HomePage />
          </AuthGuard>
        }
      />
      <Route
        path="/workspaces"
        element={
          <AuthGuard>
            <HomePage />
          </AuthGuard>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <HomePage />
          </AuthGuard>
        }
      />
      <Route
        path="/organizations"
        element={
          <AuthGuard>
            <HomePage />
          </AuthGuard>
        }
      />

      {/* 2. Unified Workplace Level: /workplace (Hierarchy: Organization -> Applications -> Branches) */}
      <Route
        path="/workplace"
        element={
          <AuthGuard>
            <WorkplacePage />
          </AuthGuard>
        }
      />
      <Route
        path="/applications"
        element={<Navigate to="/workplace" replace />}
      />
      <Route
        path="/application"
        element={<Navigate to="/workplace" replace />}
      />
      <Route
        path="/branches"
        element={<Navigate to="/workplace" replace />}
      />
      <Route
        path="/branche"
        element={<Navigate to="/workplace" replace />}
      />

      {/* 4. Settings */}
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/general"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/business"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/address"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/branding"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/localization"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/notifications"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/applications"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/organization"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/branches"
        element={
          <AuthGuard>
            <BranchSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/branches/:branchId"
        element={
          <AuthGuard>
            <BranchSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/inventory"
        element={
          <AuthGuard>
            <InventorySettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/members"
        element={
          <AuthGuard>
            <WorkspaceMembers />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/invitations"
        element={
          <AuthGuard>
            <WorkspaceInvitationsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/danger-zone"
        element={
          <AuthGuard>
            <WorkspaceDangerZone />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/danger"
        element={
          <AuthGuard>
            <WorkspaceDangerZone />
          </AuthGuard>
        }
      />
      <Route
        path="/workspaces/:workspaceId/settings"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/workspaces/:workspaceId/danger-zone"
        element={
          <AuthGuard>
            <WorkspaceDangerZone />
          </AuthGuard>
        }
      />
      <Route
        path="/workspaces/:workspaceId/invitations"
        element={
          <AuthGuard>
            <WorkspaceInvitationsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/workspaces/:workspaceId/members"
        element={
          <AuthGuard>
            <WorkspaceMembers />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/profile"
        element={
          <AuthGuard>
            <ProfileSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/billing"
        element={
          <AuthGuard>
            <BillingSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/billing/settings"
        element={
          <AuthGuard>
            <BillingSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/billing"
        element={
          <AuthGuard>
            <BillingSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/orgs/:orgId/billing"
        element={
          <AuthGuard>
            <BillingSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/invoices/:invoiceId"
        element={
          <AuthGuard>
            <InvoiceDetailPage />
          </AuthGuard>
        }
      />
      <Route
        path="/orgs/:orgId/invoices/:invoiceId"
        element={
          <AuthGuard>
            <InvoiceDetailPage />
          </AuthGuard>
        }
      />

      {/* Application Activation & Branch Management */}
      <Route
        path="/orgs/:orgId/apps"
        element={
          <AuthGuard>
            <AppActivationPage />
          </AuthGuard>
        }
      />
      <Route
        path="/orgs/:orgId/apps/:appKey/branches"
        element={
          <AuthGuard>
            <BranchSetupPage />
          </AuthGuard>
        }
      />

      <Route
        path="/settings/usage"
        element={
          <AuthGuard>
            <UsagePage />
          </AuthGuard>
        }
      />
      <Route
        path="/billing/usage"
        element={
          <AuthGuard>
            <UsagePage />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

