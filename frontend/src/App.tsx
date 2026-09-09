import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/auth/AuthGuard";
import { useHost } from "./host/useHost";
import { useSessionTracker } from "./hooks/useSessionTracker";

import MarketingApp from "./surfaces/marketing/App";
import AccountsApp from "./surfaces/accounts/App";
import HomeApp from "./surfaces/home/App";
import LauncherApp from "./surfaces/launcher/App";
import InventoryApp from "./surfaces/inventory/App";
import TaskManagementApp from "./surfaces/taskmanagement/App";

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
import { CreateWorkspaceForm } from "./pages/workspaces/CreateWorkspaceForm";

// Workspaces & Hub
import { Dashboard } from "./pages/Dashboard";

// Inventory Flagship MVP
import { InventoryDashboard } from "./pages/inventory/InventoryDashboard";
import { InventoryLanding } from "./surfaces/inventory/pages/Landing";
import { InventoryOnboarding } from "./pages/inventory/InventoryOnboarding";
import { OrganizationSettings } from "./pages/settings/OrganizationSettings";
import { BillingSettingsPage } from "./pages/billing/BillingSettingsPage";

// Coming Soon Future Apps
import { ComingSoonPage } from "./pages/ComingSoonPage";

function FallbackRoutes() {
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
            <CreateWorkspaceForm />
          </AuthGuard>
        }
      />
      <Route
        path="/organizations/new"
        element={
          <AuthGuard>
            <CreateWorkspaceForm />
          </AuthGuard>
        }
      />

      {/* 5. Inventory Application (Flagship MVP) */}
      <Route path="/inventory" element={<InventoryLanding />} />
      <Route
        path="/inventory/dashboard"
        element={
          <AuthGuard>
            <InventoryDashboard />
          </AuthGuard>
        }
      />
      <Route
        path="/inventory/dashboard/*"
        element={
          <AuthGuard>
            <InventoryDashboard />
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
            <OrganizationSettings />
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
        path="/settings/workspaces/:workspaceId"
        element={
          <AuthGuard>
            <OrganizationSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/settings/workspace"
        element={
          <AuthGuard>
            <OrganizationSettings />
          </AuthGuard>
        }
      />

      {/* 6. Future Apps - "Coming Soon" */}
      <Route path="/tasks" element={<ComingSoonPage appName="Task Management" />} />
      <Route path="/taskmanagement" element={<ComingSoonPage appName="Task Management" />} />
      <Route path="/pos" element={<ComingSoonPage appName="POS" />} />
      <Route path="/booking" element={<ComingSoonPage appName="Booking" />} />
      <Route path="/gym" element={<ComingSoonPage appName="Gym Management" />} />

      {/* 7. Workspaces Hub */}
      <Route
        path="/workspaces"
        element={
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        }
      />
      <Route
        path="/workspaces/*"
        element={
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        }
      />
      <Route path="/app" element={<Navigate to="/workspaces" replace />} />
      <Route path="/apps" element={<Navigate to="/workspaces" replace />} />
      <Route path="/launcher" element={<Navigate to="/workspaces" replace />} />
      <Route path="/home" element={<Navigate to="/workspaces" replace />} />

      {/* 8. Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  useSessionTracker();
  const host = useHost();

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
}

export default App;
