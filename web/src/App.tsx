// No React import needed
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './components/auth/AuthGuard';
import { Toaster } from './components/ui/sonner';
import { getCurrentSubdomain } from './lib/domain';

// Auth
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { VerifyEmail } from './pages/auth/VerifyEmail';
import { AcceptInvite } from './pages/auth/AcceptInvite';
import { AuthCallback } from './pages/auth/AuthCallback';
import { ConfirmEmailChange } from './pages/auth/ConfirmEmailChange';

// Settings
import { OrganizationSettings } from './pages/settings/OrganizationSettings';
import { WorkspaceMembers } from './pages/settings/WorkspaceMembers';

// Onboarding
import { OrganizationSetup } from './pages/onboarding/OrganizationSetup';
import { ModuleSelection } from './pages/onboarding/ModuleSelection';
import { WorkspaceInit } from './pages/onboarding/WorkspaceInit';
import { TeamInvite } from './pages/onboarding/TeamInvite';
import { Complete } from './pages/onboarding/Complete';

// App & Launcher
import { Dashboard } from './pages/Dashboard';
import { LandingPage } from './pages/LandingPage';
import { WelcomeProfile } from './pages/welcome/WelcomeProfile';
import { CreateWorkspace } from './pages/workspaces/CreateWorkspace';
import { WorkspaceSelector } from './pages/workspaces/WorkspaceSelector';
import { AppLauncher } from './pages/launcher/AppLauncher';
import { InventoryOnboarding } from './pages/inventory/InventoryOnboarding';
import { InventoryDashboard } from './pages/inventory/InventoryDashboard';
import { AppProductLanding } from './pages/products/AppProductLanding';
import { PricingPage } from './pages/pricing/PricingPage';

// Profile Pages (accounts.orviohub.com/profile/*)
import { PersonalProfile } from './pages/profile/PersonalProfile';
import { ContactSettings } from './pages/profile/ContactSettings';
import { SecuritySettings } from './pages/profile/SecuritySettings';
import { SessionsSettings } from './pages/profile/SessionsSettings';
import { ActivitySettings } from './pages/profile/ActivitySettings';
import { NotificationSettings } from './pages/profile/NotificationSettings';
import { PreferencesSettings } from './pages/profile/PreferencesSettings';
import { WorkspacesSettings } from './pages/profile/WorkspacesSettings';
import { PrivacySettings } from './pages/profile/PrivacySettings';
import { AccountDeletion } from './pages/profile/AccountDeletion';

// Component to dynamically resolve the root "/" route based on active subdomain
const SubdomainRootResolver: React.FC = () => {
  const subdomain = getCurrentSubdomain();

  switch (subdomain) {
    case 'inventory':
      return (
        <AuthGuard>
          <InventoryDashboard />
        </AuthGuard>
      );
    case 'launcher':
      return (
        <AuthGuard>
          <AppLauncher />
        </AuthGuard>
      );
    case 'accounts':
      return (
        <AuthGuard>
          <PersonalProfile />
        </AuthGuard>
      );
    case 'taskmanagement':
      return <AppProductLanding />;
    default:
      return <LandingPage />;
  }
};

function App() {
  return (
    <>
      <Routes>
        {/* Dynamic Root Route based on Subdomain (*.localhost or *.orviohub.com) */}
        <Route path="/" element={<SubdomainRootResolver />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* Public / Guest Routes */}
        <Route path="/login" element={<AuthGuard requireGuest><Login /></AuthGuard>} />
        <Route path="/signup" element={<AuthGuard requireGuest><Signup /></AuthGuard>} />
        <Route path="/forgot-password" element={<AuthGuard requireGuest><ForgotPassword /></AuthGuard>} />
        <Route path="/reset-password" element={<AuthGuard requireGuest><ResetPassword /></AuthGuard>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* Verify Email is tricky: can be accessed logged in or out, but usually right after signup */}
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
        
        {/* Invites can be clicked from email, handled by AcceptInvite logic directly */}
        <Route path="/invite/:token" element={<AcceptInvite />} />
        <Route path="/invitations/:token" element={<AcceptInvite />} />

        {/* Central Accounts Welcome Hub & Workspace Management */}
        <Route path="/welcome" element={<AuthGuard><WelcomeProfile /></AuthGuard>} />
        <Route path="/workspaces" element={<AuthGuard><WorkspaceSelector /></AuthGuard>} />
        <Route path="/workspaces/new" element={<AuthGuard><CreateWorkspace /></AuthGuard>} />
        <Route path="/workspaces/create" element={<AuthGuard><CreateWorkspace /></AuthGuard>} />

        {/* Dedicated Personal Profile Routes (accounts.orviohub.com/profile/*) */}
        <Route path="/profile" element={<Navigate to="/profile/personal" replace />} />
        <Route path="/profile/personal" element={<AuthGuard><PersonalProfile /></AuthGuard>} />
        <Route path="/profile/contact" element={<AuthGuard><ContactSettings /></AuthGuard>} />
        <Route path="/profile/security" element={<AuthGuard><SecuritySettings /></AuthGuard>} />
        <Route path="/profile/security/connected-accounts" element={<AuthGuard><SecuritySettings /></AuthGuard>} />
        <Route path="/profile/security/password" element={<AuthGuard><SecuritySettings /></AuthGuard>} />
        <Route path="/profile/sessions" element={<AuthGuard><SessionsSettings /></AuthGuard>} />
        <Route path="/profile/activity" element={<AuthGuard><ActivitySettings /></AuthGuard>} />
        <Route path="/profile/notifications" element={<AuthGuard><NotificationSettings /></AuthGuard>} />
        <Route path="/profile/preferences" element={<AuthGuard><PreferencesSettings /></AuthGuard>} />
        <Route path="/profile/workspaces" element={<AuthGuard><WorkspacesSettings /></AuthGuard>} />
        <Route path="/profile/privacy" element={<AuthGuard><PrivacySettings /></AuthGuard>} />
        <Route path="/profile/delete" element={<AuthGuard><AccountDeletion /></AuthGuard>} />

        {/* Onboarding Routes - Require Auth but prevent access if completed */}
        <Route path="/onboarding">
          <Route path="organization" element={<AuthGuard><OrganizationSetup /></AuthGuard>} />
          <Route path="modules" element={<AuthGuard><ModuleSelection /></AuthGuard>} />
          <Route path="workspace" element={<AuthGuard><WorkspaceInit /></AuthGuard>} />
          <Route path="team" element={<AuthGuard><TeamInvite /></AuthGuard>} />
          <Route path="complete" element={<AuthGuard><Complete /></AuthGuard>} />
        </Route>

        {/* Inventory Product Application Routes */}
        <Route path="/inventory/onboarding" element={<AuthGuard><InventoryOnboarding /></AuthGuard>} />
        <Route path="/inventory/dashboard" element={<AuthGuard><InventoryDashboard /></AuthGuard>} />
        <Route path="/inventory" element={<Navigate to="/inventory/dashboard" replace />} />

        {/* Product & App Dedicated Landing Pages */}
        <Route path="/app/inventory" element={<AppProductLanding />} />
        <Route path="/app/taskmanagement" element={<AppProductLanding />} />
        <Route path="/app/:appId" element={<AppProductLanding />} />

        {/* App Launcher & Multi-Product Switcher */}
        <Route path="/launcher" element={<AuthGuard><AppLauncher /></AuthGuard>} />
        <Route path="/app" element={<AuthGuard><AppLauncher /></AuthGuard>} />
        <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/settings/profile" element={<Navigate to="/profile/personal" replace />} />
        <Route path="/settings/organization" element={<AuthGuard><OrganizationSettings /></AuthGuard>} />
        <Route path="/settings/members" element={<AuthGuard><WorkspaceMembers /></AuthGuard>} />

        {/* Fallbacks */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
