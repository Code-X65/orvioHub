import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "../../components/auth/AuthGuard";
import { Dashboard } from "../../pages/Dashboard";
import { OrganizationSettings } from "../../pages/settings/OrganizationSettings";
import { WorkspaceMembers } from "../../pages/settings/WorkspaceMembers";
import { ProfileSettings } from "../../pages/settings/ProfileSettings";
import { AcceptInvite } from "../../pages/auth/AcceptInvite";

export default function HomeApp() {
  return (
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />
      <Route
        path="/"
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
        path="/settings/organization"
        element={
          <AuthGuard>
            <OrganizationSettings />
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
        path="/settings/profile"
        element={
          <AuthGuard>
            <ProfileSettings />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
