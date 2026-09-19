import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";

// Public & Marketing Pages
import { LandingPage } from "./pages/LandingPage";
import { PricingPage } from "./pages/pricing/PricingPage";
import { PaymentPage } from "./pages/billing/PaymentPage";
import { BillingCallbackPage } from "./pages/billing/BillingCallbackPage";
import { AppProductLanding } from "./pages/products/AppProductLanding";

// Auth Pages
import { Login } from "./pages/auth/Login";
import { Signup } from "./pages/auth/Signup";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { ResetPassword } from "./pages/auth/ResetPassword";
import { VerifyEmail } from "./pages/auth/VerifyEmail";
import { VerifyPhone } from "./pages/auth/VerifyPhone";
import { AuthCallback } from "./pages/auth/AuthCallback";
import { ConfirmEmailChange } from "./pages/auth/ConfirmEmailChange";
import { AcceptInvite } from "./pages/auth/AcceptInvite";

// Profile & Account Settings
import { PersonalProfile } from "./pages/profile/PersonalProfile";
import { ProfileSetup } from "./pages/onboarding/ProfileSetup";
import { ContactSettings } from "./pages/profile/ContactSettings";
import { SecuritySettings } from "./pages/profile/SecuritySettings";
import { SessionsSettings } from "./pages/profile/SessionsSettings";
import { ActivitySettings } from "./pages/profile/ActivitySettings";
import { NotificationSettings } from "./pages/profile/NotificationSettings";
import { PreferencesSettings } from "./pages/profile/PreferencesSettings";
import { WorkspacesSettings } from "./pages/profile/WorkspacesSettings";
import { PrivacySettings } from "./pages/profile/PrivacySettings";
import { AccountDeletion } from "./pages/profile/AccountDeletion";

// Onboarding Pages
import { WelcomeChoice } from "./pages/onboarding/WelcomeChoice";
import { OrganizationWizard } from "./pages/onboarding/OrganizationWizard";
import { ModuleSelection } from "./pages/onboarding/ModuleSelection";
import { TeamInvite } from "./pages/onboarding/TeamInvite";
import { Complete } from "./pages/onboarding/Complete";
import { PersonalOnboarding } from "./pages/onboarding/PersonalOnboarding";

// Home Surface Hub (Organizations -> Applications -> Branches)
import { HomePage } from "./surfaces/home/pages/HomePage";
import { ApplicationsPage } from "./surfaces/home/pages/ApplicationsPage";
import { BranchesPage } from "./surfaces/home/pages/BranchesPage";

// Inventory Flagship MVP
import { InventoryLayout } from "./layouts/InventoryLayout";
import { InventoryDashboard } from "./pages/inventory/InventoryDashboard";
import { InventoryLanding } from "./surfaces/inventory/pages/Landing";
import { InventoryOnboarding } from "./pages/inventory/InventoryOnboarding";
import { WorkspaceSettingsPage } from "./pages/settings/WorkspaceSettingsPage";
import { InventorySettingsPage } from "./pages/settings/InventorySettingsPage";
import { BranchSettingsPage } from "./pages/settings/BranchSettingsPage";
import { WorkspaceMembers } from "./pages/settings/WorkspaceMembers";
import { BranchTeamManagement } from "./pages/inventory/BranchTeamManagement";
import { ApplicationTeamListPage } from "./pages/team/ApplicationTeamListPage";
import { AddTeamMemberPage } from "./pages/team/AddTeamMemberPage";
import { BulkAddTeamMembersPage } from "./pages/team/BulkAddTeamMembersPage";
import { TeamMemberDetailPage } from "./pages/team/TeamMemberDetailPage";
import { TransferStaffWizardPage } from "./pages/team/TransferStaffWizardPage";
import { BranchVisualOrgPage } from "./pages/team/BranchVisualOrgPage";
import { TeamInvitationsPage } from "./pages/team/TeamInvitationsPage";
import { TeamAuditLogPage } from "./pages/team/TeamAuditLogPage";
import { PersonalTeamView } from "./pages/team/PersonalTeamView";
import { TeamMigrationPage } from "./pages/team/TeamMigrationPage";
import {
  ProductsCatalogPage,
  SalesPOSPage,
  StockTransfersPage,
  ReportsAnalyticsPage,
} from "./pages/inventory/InventoryDemoViews";
import { BillingSettingsPage } from "./pages/billing/BillingSettingsPage";
import { InvoiceDetailPage } from "./pages/billing/InvoiceDetailPage";
import { AppActivationPage } from "./pages/apps/AppActivationPage";
import { BranchSetupPage } from "./pages/apps/BranchSetupPage";

// Coming Soon Future Apps
import { ComingSoonPage } from "./pages/ComingSoonPage";

// Superadmin Portal
import { AdminOrganizationsPage } from "./pages/admin/AdminOrganizationsPage";
import { AdminOrganizationDetailPage } from "./pages/admin/AdminOrganizationDetailPage";

export function FallbackRoutes() {
  return (
    <Routes>
      {/* 1. Public Marketing & Product Pages */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/payment" element={<PaymentPage />} />
      <Route path="/billing/callback" element={<BillingCallbackPage />} />
      <Route path="/products" element={<AppProductLanding />} />
      <Route path="/features" element={<AppProductLanding />} />

      {/* 2. Authentication & Verification */}
      <Route
        path="/login"
        element={
          <AuthGuard requireGuest>
            <Login />
          </AuthGuard>
        }
      />
      <Route
        path="/signup"
        element={
          <AuthGuard requireGuest>
            <Signup />
          </AuthGuard>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <AuthGuard requireGuest>
            <ForgotPassword />
          </AuthGuard>
        }
      />
      <Route
        path="/reset-password"
        element={
          <AuthGuard requireGuest>
            <ResetPassword />
          </AuthGuard>
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/verify-email/change" element={<VerifyEmail initialChangeOpen />} />
      <Route path="/verify-email/:tokenParam" element={<VerifyEmail />} />
      <Route path="/verify-phone" element={<VerifyPhone />} />
      <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />

      {/* 3. Personal Profile & Account Settings */}
      <Route path="/profile" element={<Navigate to="/profile/personal" replace />} />
      <Route
        path="/profile/personal"
        element={
          <AuthGuard>
            <PersonalProfile />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/contact"
        element={
          <AuthGuard>
            <ContactSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/security"
        element={
          <AuthGuard>
            <SecuritySettings />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/security/connected-accounts"
        element={
          <AuthGuard>
            <SecuritySettings />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/security/password"
        element={
          <AuthGuard>
            <SecuritySettings />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/sessions"
        element={
          <AuthGuard>
            <SessionsSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/activity"
        element={
          <AuthGuard>
            <ActivitySettings />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/notifications"
        element={
          <AuthGuard>
            <NotificationSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/preferences"
        element={
          <AuthGuard>
            <PreferencesSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/workspaces"
        element={
          <AuthGuard>
            <WorkspacesSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/privacy"
        element={
          <AuthGuard>
            <PrivacySettings />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/delete"
        element={
          <AuthGuard>
            <AccountDeletion />
          </AuthGuard>
        }
      />
      <Route
        path="/profile/setup"
        element={
          <AuthGuard>
            <ProfileSetup />
          </AuthGuard>
        }
      />

      {/* 4. Onboarding Flow */}
      <Route
        path="/welcome"
        element={
          <AuthGuard>
            <WelcomeChoice />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding"
        element={
          <AuthGuard>
            <WelcomeChoice />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/welcome"
        element={
          <AuthGuard>
            <WelcomeChoice />
          </AuthGuard>
        }
      />
      <Route
        path="/onboard/personal"
        element={
          <AuthGuard>
            <PersonalOnboarding />
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
        path="/onboarding/profile"
        element={
          <AuthGuard>
            <ProfileSetup />
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
        path="/onboarding/workspace"
        element={
          <AuthGuard>
            <OrganizationWizard />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/modules"
        element={
          <AuthGuard>
            <ModuleSelection />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/team"
        element={
          <AuthGuard>
            <TeamInvite />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/complete"
        element={
          <AuthGuard>
            <Complete />
          </AuthGuard>
        }
      />
      <Route
        path="/onboarding/inventory"
        element={
          <AuthGuard>
            <InventoryOnboarding />
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

      {/* 5. Inventory Application (Flagship MVP) */}
      <Route path="/inventory" element={<InventoryLanding />} />
      <Route
        path="/inventory/dashboard"
        element={
          <AuthGuard>
            <InventoryLayout>
              <InventoryDashboard />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard/*"
        element={
          <AuthGuard>
            <InventoryLayout>
              <InventoryDashboard />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/products"
        element={
          <AuthGuard>
            <InventoryLayout>
              <ProductsCatalogPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/sales"
        element={
          <AuthGuard>
            <InventoryLayout>
              <SalesPOSPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/stock"
        element={
          <AuthGuard>
            <InventoryLayout>
              <StockTransfersPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/reports"
        element={
          <AuthGuard>
            <InventoryLayout>
              <ReportsAnalyticsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team"
        element={
          <AuthGuard>
            <InventoryLayout>
              <ApplicationTeamListPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team/members"
        element={
          <AuthGuard>
            <InventoryLayout>
              <ApplicationTeamListPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team/members/add"
        element={
          <AuthGuard>
            <InventoryLayout>
              <AddTeamMemberPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team/members/bulk-add"
        element={
          <AuthGuard>
            <InventoryLayout>
              <BulkAddTeamMembersPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team/members/:userId"
        element={
          <AuthGuard>
            <InventoryLayout>
              <TeamMemberDetailPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team/members/:userId/transfer"
        element={
          <AuthGuard>
            <InventoryLayout>
              <TransferStaffWizardPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team/branches"
        element={
          <AuthGuard>
            <InventoryLayout>
              <BranchVisualOrgPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team/invitations"
        element={
          <AuthGuard>
            <InventoryLayout>
              <TeamInvitationsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/team/audit"
        element={
          <AuthGuard>
            <InventoryLayout>
              <TeamAuditLogPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/my-team"
        element={
          <AuthGuard>
            <InventoryLayout>
              <PersonalTeamView />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/settings/team-migration"
        element={
          <AuthGuard>
            <InventoryLayout>
              <TeamMigrationPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/settings/branch"
        element={
          <AuthGuard>
            <InventoryLayout>
              <BranchSettingsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/settings/branches/:branchId"
        element={
          <AuthGuard>
            <InventoryLayout>
              <BranchSettingsPage />
            </InventoryLayout>
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/onboarding"
        element={
          <AuthGuard>
            <InventoryOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/settings"
        element={
          <AuthGuard>
            <InventoryLayout>
              <BranchSettingsPage />
            </InventoryLayout>
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
      <Route
        path="/orgs/:orgId/billing"
        element={
          <AuthGuard>
            <BillingSettingsPage />
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
        path="/apps"
        element={
          <AuthGuard>
            <ApplicationsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/applications"
        element={
          <AuthGuard>
            <ApplicationsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/branches"
        element={
          <AuthGuard>
            <BranchesPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/workspaces/:workspaceId"
        element={
          <AuthGuard>
            <WorkspaceSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/workspace"
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
        path="/settings/members"
        element={
          <AuthGuard>
            <WorkspaceMembers />
          </AuthGuard>
        }
      />

      {/* 6. Future Apps - "Coming Soon" */}
      <Route path="/tasks" element={<ComingSoonPage appName="Task Management" />} />
      <Route path="/taskmanagement" element={<ComingSoonPage appName="Task Management" />} />
      <Route path="/pos" element={<ComingSoonPage appName="POS" />} />
      <Route path="/booking" element={<ComingSoonPage appName="Booking" />} />
      <Route path="/gym" element={<ComingSoonPage appName="Gym Management" />} />

      {/* 7. Workspaces & Organizations Hub */}
      <Route
        path="/workspaces"
        element={
          <AuthGuard>
            <HomePage />
          </AuthGuard>
        }
      />
      <Route
        path="/workspaces/*"
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
        path="/dashboard/*"
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
      {/* 8. Superadmin Portal */}
      <Route
        path="/admin"
        element={
          <AuthGuard>
            <AdminOrganizationsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/admin/overview"
        element={
          <AuthGuard>
            <AdminOrganizationsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/admin/organizations"
        element={
          <AuthGuard>
            <AdminOrganizationsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/admin/organizations/:workspaceId"
        element={
          <AuthGuard>
            <AdminOrganizationDetailPage />
          </AuthGuard>
        }
      />

      {/* 9. Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default FallbackRoutes;
