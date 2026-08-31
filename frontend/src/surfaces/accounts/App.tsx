import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "../../components/auth/AuthGuard";

// Auth Pages
import { Login } from "../../pages/auth/Login";
import { Signup } from "../../pages/auth/Signup";
import { ForgotPassword } from "../../pages/auth/ForgotPassword";
import { ResetPassword } from "../../pages/auth/ResetPassword";
import { VerifyEmail } from "../../pages/auth/VerifyEmail";
import { AcceptInvite } from "../../pages/auth/AcceptInvite";
import { AuthCallback } from "../../pages/auth/AuthCallback";
import { ConfirmEmailChange } from "../../pages/auth/ConfirmEmailChange";

// Profile & Account Settings Pages
import { PersonalProfile } from "../../pages/profile/PersonalProfile";
import { ProfileSetup } from "../../pages/onboarding/ProfileSetup";
import { ContactSettings } from "../../pages/profile/ContactSettings";
import { SecuritySettings } from "../../pages/profile/SecuritySettings";
import { SessionsSettings } from "../../pages/profile/SessionsSettings";
import { ActivitySettings } from "../../pages/profile/ActivitySettings";
import { NotificationSettings } from "../../pages/profile/NotificationSettings";
import { PreferencesSettings } from "../../pages/profile/PreferencesSettings";
import { WorkspacesSettings } from "../../pages/profile/WorkspacesSettings";
import { PrivacySettings } from "../../pages/profile/PrivacySettings";
import { AccountDeletion } from "../../pages/profile/AccountDeletion";

export default function AccountsApp() {
  return (
    <Routes>
      {/* Root redirect for accounts surface: authenticated -> profile, guest -> login */}
      <Route
        path="/"
        element={
          <AuthGuard>
            <PersonalProfile />
          </AuthGuard>
        }
      />

      {/* Guest / Auth Routes */}
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
      <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />

      {/* Invitations */}
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />

      {/* Dedicated Personal Profile / Account Settings */}
      <Route path="/profile" element={<Navigate to="/profile/personal" replace />} />
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
