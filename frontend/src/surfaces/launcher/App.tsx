import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "../../components/auth/AuthGuard";
import { AppLauncher } from "../../pages/launcher/AppLauncher";
import { CreateWorkspaceForm } from "../../pages/workspaces/CreateWorkspaceForm";
import { AppProductLanding } from "../../pages/products/AppProductLanding";
import { PricingPage } from "../../pages/pricing/PricingPage";
import { BillingCallbackPage } from "../../pages/billing/BillingCallbackPage";
import { AcceptInvite } from "../../pages/auth/AcceptInvite";

import { WelcomeChoice } from "../../pages/onboarding/WelcomeChoice";
import { ProfileSetup } from "../../pages/onboarding/ProfileSetup";
import { OrganizationWizard } from "../../pages/onboarding/OrganizationWizard";
import { ModuleSelection } from "../../pages/onboarding/ModuleSelection";
import { WorkspaceInit } from "../../pages/onboarding/WorkspaceInit";
import { TeamInvite } from "../../pages/onboarding/TeamInvite";
import { Complete } from "../../pages/onboarding/Complete";

export default function LauncherApp() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AuthGuard>
            <AppLauncher />
          </AuthGuard>
        }
      />
      <Route
        path="/app"
        element={
          <AuthGuard>
            <AppLauncher />
          </AuthGuard>
        }
      />
      <Route
        path="/launcher"
        element={
          <AuthGuard>
            <AppLauncher />
          </AuthGuard>
        }
      />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/billing/callback" element={<BillingCallbackPage />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />

      {/* Workspace / Organization creation */}
      <Route
        path="/organizations/new"
        element={
          <AuthGuard>
            <CreateWorkspaceForm />
          </AuthGuard>
        }
      />
      <Route
        path="/app/organizations/new"
        element={
          <AuthGuard>
            <CreateWorkspaceForm />
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

      {/* Onboarding Flow */}
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
        path="/profile/setup"
        element={
          <AuthGuard>
            <ProfileSetup />
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
      <Route path="/onboarding">
        <Route
          path="modules"
          element={
            <AuthGuard>
              <ModuleSelection />
            </AuthGuard>
          }
        />
        <Route
          path="workspace"
          element={
            <AuthGuard>
              <WorkspaceInit />
            </AuthGuard>
          }
        />
        <Route
          path="team"
          element={
            <AuthGuard>
              <TeamInvite />
            </AuthGuard>
          }
        />
        <Route
          path="complete"
          element={
            <AuthGuard>
              <Complete />
            </AuthGuard>
          }
        />
      </Route>

      {/* Dedicated App Product Previews */}
      <Route path="/app/:appId" element={<AppProductLanding />} />
      <Route path="/inventory" element={<AppProductLanding />} />
      <Route path="/taskmanagement" element={<AppProductLanding />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
